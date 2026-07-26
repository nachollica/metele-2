"""
Static-vector word logic, free of any HTTP/auth/DB coupling.

``expand_related`` turns "category" seeds (e.g. ``["animal", "fruta"]``) into a
game word pool. Tight relatedness is *not* a goal: a seed only nudges the pool,
so ``dog`` may pull in ``cat`` and ``bone`` but ``plane`` is perfectly fine too.
Each seed contributes its nearest neighbours over the language's precomputed
vector matrix; the neighbours are then deliberately diluted with random pool
words (:data:`WordConfig.random_fraction`) and shuffled, so the result stays
varied rather than a tight synonym cluster.

The required-word matcher — deciding whether "planes" satisfies "plane" — lives
in :mod:`app.word_match`; it is a lemma question, not a semantic one.

Everything is per-language and single-language. The pool is wordfreq's frequency
list, intersected with the language's simplemma dictionary (strips proper nouns
like "john"/"stuart") and scrubbed of loanwords both dictionaries list but that
read as the other language (a wordfreq frequency-margin guard drops "agua" from
English, "box" from Spanish — see :func:`_clean_candidates`). Vectors come from
that language's own mono-lingual fastText file. No multilingual model is ever
loaded.

At runtime this module needs only numpy: the per-language matrices are baked
into the image as ``.npz`` artifacts under ``data_dir`` (see the
``build_vectors`` script and the backend Dockerfile) and loaded with mmap-speed.
wordfreq/simplemma are pulled in *only* by :func:`build_pool` at build time.

It is configured via :func:`configure` (the lifespan passes values from
``app.settings``); standalone callers fall back to environment variables, so it
never imports ``app.settings`` directly.
"""

from __future__ import annotations

import itertools
import os
import random
import re
import threading
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import numpy as np

# ---- Language ----------------------------------------------------------


class Language(str, Enum):
    """
    Supported game languages. Values match the frontend locale segment so the
    same identifier flows end-to-end.

    Scoped to en/es for now. Adding one is uncommenting a member here, then a
    rebuild to bake its pool + vector matrix (wordfreq, simplemma, and fastText
    all cover far more languages).
    """

    EN = "en"
    ES = "es"
    # FR = "fr"
    # DE = "de"
    # PT = "pt"
    # IT = "it"
    # RU = "ru"


# The languages the app builds/loads pools for. Hardcoded on purpose: adding a
# language is a code change + rebuild + redeploy, not a runtime toggle.
LANGUAGES: tuple[Language, ...] = tuple(Language)


# ---- Commonness --------------------------------------------------------


# Minimum wordfreq "zipf" score a word must clear to enter the pool at build
# time. The zipf scale runs ~0 (never seen) to ~8 (words like "the"); 2.5 keeps
# common, recognisable words while dropping obscure/scientific terms. Stored per
# word in the artifact so :func:`is_common` needs no wordfreq at runtime.
DEFAULT_MIN_ZIPF = 2.5


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


@dataclass(frozen=True)
class WordConfig:
    """Everything the engine needs to locate and tune the word pools."""

    # Where the baked ``word_pool/{lang}.npz`` artifacts live.
    data_dir: str
    # Runtime related-words tuning.
    per_seed: int = 50
    min_similarity: float = 0.25
    random_fraction: float = 0.35
    # Build-time only: how many of wordfreq's most frequent words to consider,
    # and the fastText vector dimensionality.
    vocab_size: int = 60_000
    dim: int = 300


def default_data_dir() -> str:
    """The packaged ``backend/data`` directory (baked into the image)."""
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def _config_from_env() -> WordConfig:
    """Build a config from environment variables (for CLI/script use)."""
    return WordConfig(
        data_dir=os.environ.get("WORD_DATA_DIR") or default_data_dir(),
        per_seed=int(os.environ.get("WORD_RELATED_PER_SEED", "50")),
        min_similarity=float(os.environ.get("WORD_RELATED_MIN_SIMILARITY", "0.25")),
        random_fraction=float(os.environ.get("WORD_RELATED_RANDOM_FRACTION", "0.35")),
        vocab_size=int(os.environ.get("WORD_POOL_VOCAB_SIZE", "60000")),
        dim=int(os.environ.get("WORD_VECTORS_DIM", "300")),
    )


# Single-element holder so ``configure`` can rebind the active config without a
# module-level ``global`` (ruff PLW0603). ``None`` means "derive from the env".
_active_config: list[WordConfig | None] = [None]
_state_lock = threading.Lock()


@dataclass(frozen=True)
class PoolData:
    """A language's loaded pool: aligned words, normalised vectors, and zipf."""

    words: list[str]
    matrix: np.ndarray  # (N, dim) float32, L2-normalised
    index: dict[str, int]  # casefolded word -> row
    zipf: np.ndarray  # (N,) float32


_pool_cache: dict[tuple[str, Language], PoolData] = {}


def configure(config: WordConfig) -> None:
    """
    Install the active config and drop memoised pools.

    The lifespan calls this with values from ``app.settings`` at startup; tests
    use it to point at fixture artifacts. Clearing the cache lets a reconfigure
    (e.g. a different ``data_dir``) take effect.
    """
    with _state_lock:
        _active_config[0] = config
        _pool_cache.clear()


def get_config() -> WordConfig:
    """The installed config, or one derived from the environment."""
    active = _active_config[0]
    return active if active is not None else _config_from_env()


# ---- Pool loading ------------------------------------------------------


# Bump when the pool-building logic or its inputs change so stale on-disk
# artifacts are rebuilt (and recommitted) rather than silently reused.
_POOL_VERSION = 1


def _pool_path(data_dir: str, language: Language) -> str:
    return os.path.join(data_dir, "word_pool", f"{language.value}.v{_POOL_VERSION}.npz")


def _load_pool(language: Language) -> PoolData:
    """Return the language's pool from RAM or the baked ``.npz`` (empty if absent)."""
    import numpy as np

    cfg = get_config()
    key = (cfg.data_dir, language)
    cached = _pool_cache.get(key)
    if cached is not None:
        return cached

    path = _pool_path(cfg.data_dir, language)
    if not os.path.exists(path):
        # Don't cache the miss: an artifact appearing later (e.g. a test writing
        # one, or a build finishing) should be picked up without a reconfigure.
        return PoolData(
            [], np.zeros((0, 0), dtype=np.float32), {}, np.zeros((0,), dtype=np.float32)
        )

    with _state_lock:
        cached = _pool_cache.get(key)
        if cached is not None:
            return cached
        data = np.load(path, allow_pickle=True)
        words = [str(w) for w in data["words"]]
        matrix = np.ascontiguousarray(data["vectors"], dtype=np.float32)
        zipf = np.ascontiguousarray(data["zipf"], dtype=np.float32)
        index = {word.casefold(): row for row, word in enumerate(words)}
        pool = PoolData(words, matrix, index, zipf)
        _pool_cache[key] = pool
        return pool


def ensure_ready(languages: tuple[Language, ...] = LANGUAGES) -> None:
    """
    Preload every language's pool so the first request is served from RAM.

    The lifespan calls this at startup. Missing artifacts load as empty pools
    (the feature degrades to nothing rather than crashing).
    """
    for language in languages:
        _load_pool(language)


def is_common(word: str, language: Language, min_zipf: float = DEFAULT_MIN_ZIPF) -> bool:
    """
    Whether ``word`` is in the language's pool and clears ``min_zipf``.

    Backed by the zipf value baked into the artifact, so no wordfreq at runtime.
    A word absent from the pool is not common (returns False).
    """
    pool = _load_pool(language)
    row = pool.index.get(word.casefold())
    return row is not None and float(pool.zipf[row]) >= min_zipf


# ---- Vocabulary / usability -------------------------------------------


def _is_usable_word(word: str) -> bool:
    """
    Whether ``word`` is usable as a game word.

    ``isalpha`` drops multi-word/hyphenated/digit entries (the frontend only
    checks the last finished token); the lowercase check drops proper nouns that
    kept their capital (wordfreq lowercases most, so the dictionary filter in
    :func:`build_pool` does the real proper-noun scrubbing).
    """
    return word.isalpha() and word == word.lower()


# ---- Build (build-time only) ------------------------------------------


def _read_fasttext_vectors(path: str, wanted: set[str], dim: int) -> dict[str, np.ndarray]:
    """
    Stream a fastText ``.vec``/``.vec.gz`` file, returning vectors for ``wanted``.

    fastText files are one ``word f1 f2 ... fdim`` line per token, optionally
    prefixed by a ``"<count> <dim>"`` header. Streaming keeps memory flat: only
    the small wanted subset is retained, not the multi-million-row source.
    """
    import gzip

    import numpy as np

    found: dict[str, np.ndarray] = {}

    def _consume(line: str) -> None:
        parts = line.rstrip().split(" ")
        if len(parts) <= dim:
            return
        token = parts[0]
        if token not in wanted or token in found:
            return
        values = parts[1 : dim + 1]
        found[token] = np.asarray(values, dtype=np.float32)

    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8", errors="replace") as handle:
        first = handle.readline()
        header = first.split()
        if not (len(header) == 2 and all(tok.lstrip("-").isdigit() for tok in header)):
            _consume(first)  # no header line — the first line is data
        for line in handle:
            if len(found) >= len(wanted):
                break
            _consume(line)
    return found


# A word is treated as belonging to another language (and dropped from this
# language's pool) when its zipf frequency there exceeds its frequency here by
# more than this margin. simplemma's dictionary lists common loanwords in both
# languages ("agua" in English, "box" in Spanish), so this frequency guard — not
# the dictionary alone — is what keeps a language's pool single-language.
_CROSS_LANGUAGE_MARGIN = 1.0


def _reads_as_other_language(word: str, language: Language, here_zipf: float) -> bool:
    """Whether ``word`` is markedly more frequent in another supported language."""
    from wordfreq import available_languages, zipf_frequency

    for other in Language:
        if other is language or other.value not in available_languages():
            continue
        if zipf_frequency(word, other.value) - here_zipf > _CROSS_LANGUAGE_MARGIN:
            return True
    return False


def _clean_candidates(language: Language, vocab_size: int) -> dict[str, float]:
    """
    Frequency-ranked, dictionary-clean, single-language candidate words → zipf.

    Three filters compose the pool: wordfreq's frequency list supplies common
    words (and their zipf); ``simplemma.is_known`` keeps only real dictionary
    words for *this* language (dropping proper nouns like "john"/"juan"); and the
    cross-language frequency guard drops loanwords both dictionaries list but
    that clearly read as the other language ("agua", "box"). Together they make
    the pool single-language — no cross-language leakage.
    """
    import simplemma
    from wordfreq import top_n_list, zipf_frequency

    candidates: dict[str, float] = {}
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
        if not simplemma.is_known(word, language.value):
            continue
        if _reads_as_other_language(word, language, here):
            continue
        seen.add(folded)
        candidates[word] = here
    return candidates


def build_pool(language: Language, fasttext_path: str) -> tuple[list[str], np.ndarray]:
    """
    Build and persist the language's pool from its fastText file.

    Called by the ``build_vectors`` script. Intersects the clean candidate words
    with those fastText has a vector for, L2-normalises, and writes
    ``data_dir/word_pool/{lang}.vN.npz`` (words, float16 vectors, float16 zipf).
    Vectors are float16 on disk to keep the committed artifact small; they widen
    to float32 on load for fast matmul.
    """
    import numpy as np

    cfg = get_config()
    candidates = _clean_candidates(language, cfg.vocab_size)
    vectors = _read_fasttext_vectors(fasttext_path, set(candidates), cfg.dim)

    words: list[str] = []
    rows: list[np.ndarray] = []
    zipfs: list[float] = []
    for word, here in candidates.items():
        vector = vectors.get(word)
        if vector is None:
            continue
        norm = float(np.linalg.norm(vector))
        if norm == 0.0:
            continue
        words.append(word)
        rows.append(vector / norm)
        zipfs.append(here)

    matrix = (
        np.asarray(rows, dtype=np.float32) if rows else np.zeros((0, cfg.dim), dtype=np.float32)
    )

    path = _pool_path(cfg.data_dir, language)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    np.savez(
        path,
        words=np.asarray(words, dtype=object),
        vectors=matrix.astype(np.float16),
        zipf=np.asarray(zipfs, dtype=np.float16),
    )
    result = (words, matrix)
    _pool_cache[(cfg.data_dir, language)] = PoolData(
        words, matrix, {w.casefold(): i for i, w in enumerate(words)}, np.asarray(zipfs, np.float32)
    )
    return result


# ---- Related words -----------------------------------------------------


def _shares_seed_prefix(word: str, seeds: set[str]) -> bool:
    """
    Cheap inflection guard: treat ``word`` as a seed variant if it shares a
    seed's first four characters (e.g. ``cocina`` → ``cocinar``/``cocinando``).
    """
    return any(len(seed) >= 4 and len(word) >= 4 and word[:4] == seed[:4] for seed in seeds)


def _seed_neighbours(
    scores: np.ndarray,
    pool: PoolData,
    *,
    excluded: set[str],
    min_similarity: float,
    per_seed: int,
    min_zipf: float,
) -> list[str]:
    """Ranked neighbours of one seed (by cosine score), filtered and capped."""
    import numpy as np

    picked: list[str] = []
    for idx in np.argsort(-scores):
        if float(scores[idx]) < min_similarity:
            break
        row = int(idx)
        if float(pool.zipf[row]) < min_zipf:
            continue
        word = pool.words[row]
        folded = word.casefold()
        if folded in excluded or _shares_seed_prefix(folded, excluded):
            continue
        picked.append(word)
        if len(picked) >= per_seed:
            break
    return picked


def _random_fill(
    pool: PoolData,
    *,
    count: int,
    exclude: set[str],
    min_zipf: float,
) -> list[str]:
    """``count`` random pool words not already excluded (respecting ``min_zipf``)."""
    candidates = [
        word
        for row, word in enumerate(pool.words)
        if word.casefold() not in exclude and float(pool.zipf[row]) >= min_zipf
    ]
    if len(candidates) <= count:
        random.shuffle(candidates)
        return candidates
    return random.sample(candidates, count)


def expand_related(
    words: list[str],
    language: Language,
    *,
    limit: int,
    min_zipf: float = DEFAULT_MIN_ZIPF,
) -> list[str]:
    """
    A game word pool loosely themed by the seeds.

    Each seed found in the pool contributes its nearest neighbours (cosine above
    ``min_similarity``, up to ``per_seed``), merged round-robin so every seed is
    represented. Roughly ``random_fraction`` of the ``limit`` is then filled with
    random pool words and the whole thing is shuffled, so the pool is varied
    rather than a tight cluster. Seeds absent from the pool contribute nothing;
    if none resolve, the result is simply a random pool. Best-effort: returns
    ``[]`` on any failure or empty pool.
    """
    cfg = get_config()
    seeds = [w.strip() for w in words if w.strip()]
    if not seeds or limit <= 0:
        return []
    try:
        pool = _load_pool(language)
        if not pool.words:
            return []

        excluded = {s.casefold() for s in seeds}
        seed_rows = [pool.index[s] for s in excluded if s in pool.index]

        themed: list[str] = []
        if seed_rows:
            seed_vecs = pool.matrix[seed_rows]  # (k, dim)
            sims = pool.matrix @ seed_vecs.T  # (N, k)
            per_seed_lists = [
                _seed_neighbours(
                    sims[:, si],
                    pool,
                    excluded=excluded,
                    min_similarity=cfg.min_similarity,
                    per_seed=cfg.per_seed,
                    min_zipf=min_zipf,
                )
                for si in range(len(seed_rows))
            ]
            # Round-robin so a weak seed still lands words alongside a strong one.
            seen = set(excluded)
            for tier in itertools.zip_longest(*per_seed_lists):
                for word in tier:
                    if word is None:
                        continue
                    folded = word.casefold()
                    if folded in seen:
                        continue
                    seen.add(folded)
                    themed.append(word)

        # Reserve part of the budget for random words (guaranteed variety); when
        # no seed resolved, the whole pool is random.
        n_random = round(limit * cfg.random_fraction) if themed else limit
        chosen = themed[: limit - n_random]
        exclude = {w.casefold() for w in chosen} | excluded
        chosen += _random_fill(pool, count=limit - len(chosen), exclude=exclude, min_zipf=min_zipf)

        random.shuffle(chosen)
        return chosen[:limit]
    except Exception:  # noqa: BLE001 — the feature degrades to empty rather than 500.
        return []


# ---- Random pool -------------------------------------------------------


def random_words(
    language: Language,
    *,
    limit: int,
    min_zipf: float = DEFAULT_MIN_ZIPF,
) -> list[str]:
    """
    Sample a varied pool from the language's common vocabulary.

    Draws from the same baked pool as :func:`expand_related`. No seeds, so the
    order is random by design. Returns ``[]`` if the artifact is absent.
    """
    pool = _load_pool(language)
    if not pool.words:
        return []
    return _random_fill(pool, count=limit, exclude=set(), min_zipf=min_zipf)
