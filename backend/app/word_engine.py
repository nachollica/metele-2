"""
Embedding-backed word logic, free of any HTTP/auth/DB coupling.

``expand_related`` turns "category" seeds (e.g. ``["animal", "fruta"]``) into a
pool of related words using one live multilingual sentence-transformers model:
for each seed we take its nearest neighbours over the requested language's
candidate matrix, union the seeds' neighbourhoods with a per-seed quota (so a
weak seed still shows up), and keep the common ones.

(The required-word matcher — deciding whether "planes" satisfies "plane" — lives
in :mod:`app.word_match`; it is a lemma question, not a semantic one, so it does
not use this model.)

The candidate vocabulary for every language comes from wordfreq — the same list
that supplies the commonness filter — scrubbed of cross-language words up front
(:func:`_is_cross_language`). Because a request only ever searches its own
language's matrix, results cannot leak across languages regardless of the model
being multilingual.

This module is imported by the ``/words`` route, the ``related_words`` /
``build_embeddings`` scripts, and the app lifespan, so it must not pull in
FastAPI, the DB, or auth. It is configured via :func:`configure` (the lifespan
passes values from ``app.settings``); standalone callers fall back to
environment variables, so it never imports ``app.settings`` directly.

The model and the per-language matrices are loaded lazily and memoised. In
production they are baked into the image and loaded from ``cache_dir``; a missing
artifact is downloaded/rebuilt on demand — see the backend Dockerfile and the
``build_embeddings`` script.
"""

from __future__ import annotations

import os
import random
import re
import threading
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

from wordfreq import available_languages, top_n_list, zipf_frequency

if TYPE_CHECKING:
    import numpy as np
    from sentence_transformers import SentenceTransformer

# ---- Language ----------------------------------------------------------


class Language(str, Enum):
    """
    Supported game languages. Values match the frontend locale segment so the
    same identifier flows end-to-end.

    Scoped to en/es for now. The other languages are wired everywhere else
    (wordfreq, simplemma, and the sentence model are all multilingual) — adding
    one is just uncommenting a member here, then a rebuild to bake its matrix.
    """

    EN = "en"
    ES = "es"
    # FR = "fr"
    # DE = "de"
    # PT = "pt"
    # IT = "it"
    # RU = "ru"


# The languages the app builds/loads models for. Hardcoded on purpose: adding a
# language is a code change + rebuild + redeploy, not a runtime toggle.
LANGUAGES: tuple[Language, ...] = tuple(Language)


# ---- Commonness filter -------------------------------------------------


# Minimum wordfreq "zipf" score a word must clear to count as common enough for
# the game. The zipf scale runs ~0 (never seen) to ~8 (words like "the"); 2.5
# was tuned against the hand-curated frontend pools — it keeps common words while
# dropping obscure / scientific terms (e.g. "chordate" 1.31, "Acaridae" 0.0).
DEFAULT_MIN_ZIPF = 2.5


def is_common(word: str, language: Language, min_zipf: float = DEFAULT_MIN_ZIPF) -> bool:
    """
    Whether ``word`` is frequent enough to be a fun, recognisable game word.

    Backed by wordfreq's zipf frequency for the language. Languages wordfreq
    doesn't cover are not filtered (returns True) so future languages degrade
    gracefully instead of yielding an empty pool.
    """
    if language.value not in available_languages():
        return True
    return zipf_frequency(word, language.value) >= min_zipf


# ---- Accept-Language parsing -------------------------------------------


_TAG_RE = re.compile(r"^\s*([A-Za-z]{2,3})(?:-[A-Za-z0-9]+)?\s*$")


def parse_accept_language(header: str | None) -> Language | None:
    """Pick the first supported language from ``Accept-Language``."""
    if not header:
        return None

    candidates: list[tuple[float, int, str]] = []
    for index, raw in enumerate(header.split(",")):
        part = raw.strip()
        if not part:
            continue
        tag, _, params = part.partition(";")
        weight = 1.0
        for raw_param in params.split(";"):
            param = raw_param.strip()
            if param.startswith("q="):
                try:
                    weight = float(param[2:])
                except ValueError:
                    weight = 0.0
                break
        if weight <= 0:
            continue
        match = _TAG_RE.match(tag)
        if not match:
            continue
        candidates.append((-weight, index, match.group(1).lower()))

    candidates.sort()
    for _, _, primary in candidates:
        try:
            return Language(primary)
        except ValueError:
            continue
    return None


# ---- Configuration -----------------------------------------------------


# Footprint tiers → concrete sentence-transformers model ids. Both are
# multilingual and symmetric (good for the pairwise match check); "small" is the
# default because we prefer footprint over recall.
_SIZE_TO_MODEL: dict[str, str] = {
    "small": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "large": "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
}
DEFAULT_EMBEDDING_SIZE = "small"


@dataclass(frozen=True)
class EmbeddingConfig:
    """Everything the engine needs to locate, size, and tune the model."""

    model_id: str
    cache_dir: str
    vocab_size: int = 40_000
    per_seed: int = 50
    min_similarity: float = 0.3


def resolve_model_id(size: str, override: str = "") -> str:
    """An explicit override wins; otherwise map the size tier to a model id."""
    if override:
        return override
    return _SIZE_TO_MODEL.get(size, _SIZE_TO_MODEL[DEFAULT_EMBEDDING_SIZE])


def _default_cache_dir() -> str:
    return os.path.join(os.path.expanduser("~"), ".cache", "flowfic", "embeddings")


def _config_from_env() -> EmbeddingConfig:
    """Build a config from environment variables (for CLI/script use)."""
    return EmbeddingConfig(
        model_id=resolve_model_id(
            os.environ.get("WORD_EMBEDDINGS_SIZE", DEFAULT_EMBEDDING_SIZE),
            os.environ.get("WORD_EMBEDDINGS_MODEL", ""),
        ),
        cache_dir=os.environ.get("WORD_EMBEDDINGS_DIR") or _default_cache_dir(),
        vocab_size=int(os.environ.get("WORD_EMBEDDINGS_VOCAB_SIZE", "40000")),
        per_seed=int(os.environ.get("WORD_RELATED_PER_SEED", "50")),
        min_similarity=float(os.environ.get("WORD_RELATED_MIN_SIMILARITY", "0.3")),
    )


# Single-element holder so ``configure`` can rebind the active config without a
# module-level ``global`` (ruff PLW0603). ``None`` means "derive from the env".
_active_config: list[EmbeddingConfig | None] = [None]
_state_lock = threading.Lock()
_model_cache: dict[str, SentenceTransformer] = {}
_matrix_cache: dict[tuple[str, Language], tuple[list[str], np.ndarray]] = {}


def configure(config: EmbeddingConfig) -> None:
    """
    Install the active config and drop memoised model/matrices.

    The lifespan calls this with values from ``app.settings`` at startup; tests
    use it to point at stubs. Clearing the caches lets a reconfigure (e.g. a
    different model id) take effect.
    """
    with _state_lock:
        _active_config[0] = config
        _model_cache.clear()
        _matrix_cache.clear()
        _vocab_words_cache.clear()


def get_config() -> EmbeddingConfig:
    """The installed config, or one derived from the environment."""
    active = _active_config[0]
    return active if active is not None else _config_from_env()


# ---- Vocabulary --------------------------------------------------------


def _is_usable_word(word: str) -> bool:
    """
    Whether ``word`` is usable as a game word.

    ``isalpha`` drops multi-word/hyphenated/digit entries (the frontend only
    checks the last finished token); the lowercase check drops proper nouns.
    """
    return word.isalpha() and word == word.lower()


# A word is treated as belonging to another language (and dropped from this
# language's candidate pool) when its zipf frequency there exceeds its frequency
# here by more than this margin. This keeps English loanwords that ride along in
# wordfreq's Spanish list ("food", "kitchen") out of Spanish results.
_CROSS_LANGUAGE_MARGIN = 1.0


def _is_cross_language(word: str, language: Language, here_zipf: float) -> bool:
    """
    Whether ``word`` reads as another supported language more than this one.

    ``here_zipf`` is passed in so the caller can compute it once. This is the
    structural guard that makes cross-language leakage impossible: a scrubbed
    per-language pool is the only thing the related-words search can return.
    """
    for other in Language:
        if other is language or other.value not in available_languages():
            continue
        if zipf_frequency(word, other.value) - here_zipf > _CROSS_LANGUAGE_MARGIN:
            return True
    return False


_vocab_words_cache: dict[tuple[Language, int], list[str]] = {}


def _candidate_vocabulary(language: Language, vocab_size: int) -> list[str]:
    """
    The language's candidate words: frequent, usable, single-language.

    Sourced from wordfreq's frequency list, filtered by usability, the
    commonness threshold, and the cross-language guard. Shared by the embedding
    matrix and ``random_words`` so both draw from the same scrubbed pool. The
    result is deterministic per (language, size), so it is memoised — the scan
    touches every supported language's frequency table and is not cheap.
    """
    key = (language, vocab_size)
    cached = _vocab_words_cache.get(key)
    if cached is not None:
        return cached

    words: list[str] = []
    seen: set[str] = set()
    for raw in top_n_list(language.value, vocab_size):
        word = raw.strip()
        if not word or not _is_usable_word(word):
            continue
        folded = word.casefold()
        if folded in seen:
            continue
        here = zipf_frequency(word, language.value)
        if here < DEFAULT_MIN_ZIPF:
            continue
        if _is_cross_language(word, language, here):
            continue
        seen.add(folded)
        words.append(word)
    _vocab_words_cache[key] = words
    return words


# ---- Model + matrices --------------------------------------------------


# Bump when the matrix-building logic or its inputs change so stale on-disk
# matrices are rebuilt rather than silently reused.
_MATRIX_VERSION = 1


def _load_model() -> SentenceTransformer:
    """
    Load (and memoise) the sentence-transformers model for the active config.

    The model's weights live in the standard Hugging Face cache (``HF_HOME``),
    which the Docker image bakes and pins offline; the matrices live under
    ``cache_dir``. Keeping the two locations separate avoids surprising the HF
    hub with a custom layout.
    """
    cfg = get_config()
    cached = _model_cache.get(cfg.model_id)
    if cached is not None:
        return cached
    with _state_lock:
        cached = _model_cache.get(cfg.model_id)
        if cached is None:
            from sentence_transformers import SentenceTransformer

            cached = SentenceTransformer(cfg.model_id)
            _model_cache[cfg.model_id] = cached
    return cached


def _encode(words: list[str]) -> np.ndarray:
    """Encode ``words`` into L2-normalised float32 vectors (cosine == dot)."""
    import numpy as np

    model = _load_model()
    vectors = model.encode(list(words), normalize_embeddings=True, show_progress_bar=False)
    return np.asarray(vectors, dtype=np.float32)


def _matrix_path(model_id: str, language: Language, vocab_size: int) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", model_id)
    base = get_config().cache_dir or _default_cache_dir()
    return os.path.join(base, safe, f"{language.value}.n{vocab_size}.v{_MATRIX_VERSION}.npz")


def build_matrix(language: Language) -> tuple[list[str], np.ndarray]:
    """
    Compute the normalised candidate matrix for ``language`` and persist it.

    Called by the ``build_embeddings`` script, the lifespan on a cache miss, and
    the Docker build. Vectors are stored as float16 to keep the baked artifact
    small; they are widened back to float32 on load for fast matmul.
    """
    import numpy as np

    cfg = get_config()
    words = _candidate_vocabulary(language, cfg.vocab_size)
    vectors = _encode(words) if words else np.zeros((0, 0), dtype=np.float32)

    path = _matrix_path(cfg.model_id, language, cfg.vocab_size)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    np.savez(path, words=np.asarray(words, dtype=object), vectors=vectors.astype(np.float16))
    result = (words, vectors)
    _matrix_cache[(cfg.model_id, language)] = result
    return result


def _vocab_matrix(language: Language) -> tuple[list[str], np.ndarray]:
    """Return (words, normalised float32 matrix) — from RAM, disk, or freshly built."""
    import numpy as np

    cfg = get_config()
    key = (cfg.model_id, language)
    cached = _matrix_cache.get(key)
    if cached is not None:
        return cached
    with _state_lock:
        cached = _matrix_cache.get(key)
        if cached is not None:
            return cached
        path = _matrix_path(cfg.model_id, language, cfg.vocab_size)
        if os.path.exists(path):
            data = np.load(path, allow_pickle=True)
            result = (list(data["words"]), data["vectors"].astype(np.float32))
            _matrix_cache[key] = result
            return result
    # Build outside the lock: encoding tens of thousands of words is slow and we
    # don't want to block other languages' reads. build_matrix re-populates the
    # cache under its own lock-free write (dict assignment is atomic enough here).
    return build_matrix(language)


def ensure_ready(languages: tuple[Language, ...] = LANGUAGES) -> None:
    """
    Preload the model and every language's matrix (building any that are absent).

    The lifespan calls this at startup and the build script reuses it. After it
    returns, related-words and match requests are served entirely from RAM.
    """
    _load_model()
    for language in languages:
        _vocab_matrix(language)


# ---- Related words -----------------------------------------------------


def _shares_seed_prefix(word: str, seeds: set[str]) -> bool:
    """
    Cheap inflection guard: treat ``word`` as a seed variant if it shares a
    seed's first four characters (e.g. ``cocina`` → ``cocinar``/``cocinando``).
    """
    for seed in seeds:
        if len(seed) >= 4 and len(word) >= 4 and word[:4] == seed[:4]:
            return True
    return False


def _seed_neighbours(
    scores: np.ndarray,
    vocab: list[str],
    *,
    excluded: set[str],
    min_similarity: float,
    per_seed: int,
    min_zipf: float,
    language: Language,
) -> list[tuple[str, float]]:
    """Ranked (word, score) neighbours of one seed, filtered and capped."""
    import numpy as np

    picked: list[tuple[str, float]] = []
    for idx in np.argsort(-scores):
        score = float(scores[idx])
        if score < min_similarity:
            break
        word = vocab[int(idx)]
        folded = word.casefold()
        if folded in excluded or _shares_seed_prefix(folded, excluded):
            continue
        if not is_common(word, language, min_zipf):
            continue
        picked.append((word, score))
        if len(picked) >= per_seed:
            break
    return picked


def expand_related(
    words: list[str],
    language: Language,
    *,
    limit: int,
    min_zipf: float = DEFAULT_MIN_ZIPF,
) -> list[str]:
    """
    Related words as the union of the seeds' embedding neighbourhoods.

    Each seed contributes its nearest neighbours (above ``min_similarity``, up to
    ``per_seed``). We then compose the final pool with a per-seed quota so a weak
    seed A stays represented even when a strong seed B scores higher, and fill any
    remaining slots by global score. Everything passes the wordfreq commonness
    filter (dropping weird/scientific words) and excludes the seeds and their
    inflections. Best-effort: if the model/matrix is unavailable, returns ``[]``.
    """
    cfg = get_config()
    seeds = [w.strip() for w in words if w.strip()]
    if not seeds or limit <= 0:
        return []
    try:
        vocab, matrix = _vocab_matrix(language)
        seed_vecs = _encode(seeds)
    except Exception:  # noqa: BLE001 — the feature degrades to empty rather than 500.
        return []
    if not vocab or matrix.shape[0] == 0:
        return []

    excluded = {s.casefold() for s in seeds}
    sims = matrix @ seed_vecs.T  # (vocab, seeds)
    per_seed_lists = [
        _seed_neighbours(
            sims[:, si],
            vocab,
            excluded=excluded,
            min_similarity=cfg.min_similarity,
            per_seed=cfg.per_seed,
            min_zipf=min_zipf,
            language=language,
        )
        for si in range(len(seeds))
    ]

    # Quota pass: give each seed up to ``quota`` of its own top neighbours.
    quota = max(1, limit // len(seeds))
    chosen: dict[str, float] = {}
    for picked in per_seed_lists:
        added = 0
        for word, score in picked:
            if added >= quota:
                break
            if word not in chosen:
                chosen[word] = score
                added += 1
            else:
                chosen[word] = max(chosen[word], score)

    # Global fill: best remaining neighbours across all seeds, by score.
    if len(chosen) < limit:
        pool: dict[str, float] = {}
        for picked in per_seed_lists:
            for word, score in picked:
                pool[word] = max(pool.get(word, -1.0), score)
        for word, _score in sorted(pool.items(), key=lambda kv: -kv[1]):
            if len(chosen) >= limit:
                break
            chosen.setdefault(word, _score)

    result = list(chosen)[:limit]
    random.shuffle(result)
    return result


# ---- Random pool -------------------------------------------------------


def random_words(
    language: Language,
    *,
    limit: int,
    min_zipf: float = DEFAULT_MIN_ZIPF,
) -> list[str]:
    """
    Sample a varied pool from the language's common vocabulary.

    Draws from the same scrubbed wordfreq candidate pool as the related-words
    matrix (frequent, usable, single-language). No model needed; order is random
    since the whole point is variety.
    """
    vocab = _candidate_vocabulary(language, get_config().vocab_size)
    if min_zipf != DEFAULT_MIN_ZIPF:
        vocab = [w for w in vocab if is_common(w, language, min_zipf)]
    if not vocab:
        return []
    if len(vocab) <= limit:
        random.shuffle(vocab)
        return vocab
    return random.sample(vocab, limit)
