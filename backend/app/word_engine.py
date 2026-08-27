"""
Static-vector word logic, free of any HTTP/auth/DB coupling.

``expand_related`` turns "category" seeds (e.g. ``["animal", "fruta"]``) into a
game word pool. Tight relatedness is *not* a goal: a seed only nudges the pool,
so ``dog`` may pull in ``cat`` and ``bone`` but ``plane`` is perfectly fine too.
Each seed contributes its nearest neighbours over the language's precomputed
vector matrix; the neighbours are then deliberately diluted with random pool
words (:data:`WordConfig.random_fraction`) and shuffled, so the result stays
varied rather than a tight synonym cluster.

The required-word matcher — deciding whether "planes" satisfies "plane" — is a
lemma question, not a semantic one; it runs in the frontend against a match map,
produced by the same tool that builds this pool.

Everything is per-language and single-language: the pool is wordfreq's frequency
list, kept to real dictionary words (simplemma) and scrubbed of loanwords that
read as the other language, paired with that language's own mono-lingual fastText
vectors. No multilingual model is ever involved.

This module is purely the *runtime* half: it needs only numpy, and reads the
per-language ``.npz`` pools baked under ``data_dir`` at mmap-speed. The build
half (fastText/wordfreq/simplemma/spaCy) lives outside the backend in the
top-level ``word-assets`` tool, which writes these ``.npz`` files here and the
frontend's match map. The artifacts are gitignored; the backend image build
fails loudly if the pool is missing (see the Dockerfile).

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
    """
    A language's loaded pool: aligned words, quantized vectors, and zipf.

    ``matrix`` stays int8 in RAM rather than being widened to float32 — a
    quarter the size, which matters because this is held resident for the life
    of the worker process. ``scale`` recovers the true value: component ≈
    int8_value / scale. See :func:`_cosine_similarities` for how the matmul
    stays correct (and its transient memory bounded) against a quantized matrix.
    """

    words: list[str]
    matrix: np.ndarray  # (N, dim) int8, L2-normalised before quantization
    index: dict[str, int]  # casefolded word -> row
    zipf: np.ndarray  # (N,) float32
    scale: float


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


# Filename version for the baked pool. Must match POOL_VERSION in the word-assets
# tool (the writer). Bump both when the .npz format changes so a stale artifact
# is regenerated rather than silently reused.
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
            [], np.zeros((0, 0), dtype=np.int8), {}, np.zeros((0,), dtype=np.float32), 1.0
        )

    with _state_lock:
        cached = _pool_cache.get(key)
        if cached is not None:
            return cached
        data = np.load(path, allow_pickle=True)
        words = [str(w) for w in data["words"]]
        # Stays int8 — do NOT widen to float32 here. That single cast used to be
        # the API container's largest fixed memory cost (~93MB across both
        # languages per worker, doubled again by the two uvicorn workers).
        matrix = np.ascontiguousarray(data["vectors"], dtype=np.int8)
        zipf = np.ascontiguousarray(data["zipf"], dtype=np.float32)
        scale = float(data["scale"])
        index = {word.casefold(): row for row, word in enumerate(words)}
        pool = PoolData(words, matrix, index, zipf, scale)
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


def loaded_pool_sizes() -> dict[str, int]:
    """
    Word count per language for the pools **already resident in this process**.

    Deliberately reads the memoised cache instead of calling
    :func:`_load_pool`: a language absent from the cache is simply omitted,
    never loaded on demand. ``/ping`` reports this, and an unauthenticated
    probe must not be able to trigger a multi-hundred-megabyte artifact load —
    on a small host that would fault the matrices in from swap.

    An empty mapping therefore means "nothing preloaded yet", which is itself
    the signal worth having: a worker whose artifacts failed to load answers
    ``{}`` rather than looking healthy.
    """
    cfg = get_config()
    return {
        language.value: len(pool.words)
        for (data_dir, language), pool in _pool_cache.items()
        if data_dir == cfg.data_dir
    }


def is_common(word: str, language: Language, min_zipf: float = DEFAULT_MIN_ZIPF) -> bool:
    """
    Whether ``word`` is in the language's pool and clears ``min_zipf``.

    Backed by the zipf value baked into the artifact, so no wordfreq at runtime.
    A word absent from the pool is not common (returns False).
    """
    pool = _load_pool(language)
    row = pool.index.get(word.casefold())
    return row is not None and float(pool.zipf[row]) >= min_zipf


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


# Rows processed per matmul chunk in `_cosine_similarities`. numpy's `@` between
# an int8 array and a float32 one silently upcasts the WHOLE int8 side to
# float32 to perform the multiply — verified empirically, not assumed — so an
# unchunked call would transiently recreate the exact float32-sized array this
# module exists to avoid holding resident. Chunking bounds that transient to
# CHUNK_ROWS * dim * 4 bytes (a few MB) regardless of pool size. The call is
# rare (once per session start, never per keystroke), so the bound only needs
# to be small, not zero.
_SIMILARITY_CHUNK_ROWS = 8000


def _cosine_similarities(pool: PoolData, seed_rows: list[int]) -> np.ndarray:
    """
    Cosine similarity between every pool word and each seed, as (N, k) float32.

    ``pool.matrix`` stays int8 the whole time; only the few seed rows are
    dequantized (cheap — k rows, not N). The algebra: a stored component is
    ``q ≈ true * scale``, so for int8 chunk ``Q`` and true-scale seed matrix
    ``S``, ``Q @ S.T == (true_chunk * scale) @ S.T == scale * (true_chunk @
    S.T)``. Dividing the accumulated result by ``scale`` once at the end is
    equivalent to dequantizing the pool and far cheaper than doing it per row.
    """
    import numpy as np

    seed_true = pool.matrix[seed_rows].astype(np.float32) / pool.scale  # (k, dim), tiny
    n_rows = pool.matrix.shape[0]
    sims = np.empty((n_rows, len(seed_rows)), dtype=np.float32)
    for start in range(0, n_rows, _SIMILARITY_CHUNK_ROWS):
        end = min(start + _SIMILARITY_CHUNK_ROWS, n_rows)
        # This cast is where the transient upcast happens — bounded to one
        # chunk's worth (dim * CHUNK_ROWS * 4 bytes) rather than the whole pool.
        sims[start:end] = pool.matrix[start:end].astype(np.float32) @ seed_true.T
    sims /= pool.scale
    return sims


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
            sims = _cosine_similarities(pool, seed_rows)  # (N, k)
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
