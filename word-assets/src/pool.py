"""
Build the per-language vector pool (``backend/data/word_pool/{lang}.vN.npz``).

The pool is wordfreq's frequency list, kept to real dictionary words for the
language (``simplemma.is_known``, which strips proper nouns), scrubbed of
loanwords that read as the other language (a frequency-margin guard), and paired
with that language's own mono-lingual fastText vectors. Per-language sources make
cross-language leakage impossible. Consumed by the backend runtime for the
related-words / random-words features.
"""

from __future__ import annotations

import gzip
import os

import numpy as np
import simplemma
from wordfreq import available_languages, top_n_list, zipf_frequency

from contract import (
    DEFAULT_MIN_ZIPF,
    LANGUAGES,
    NPZ_SCALE,
    NPZ_VECTORS,
    NPZ_WORDS,
    NPZ_ZIPF,
    pool_path,
)

# A word is treated as belonging to another language (and dropped) when its zipf
# frequency there exceeds its frequency here by more than this margin. simplemma
# lists common loanwords in both dictionaries ("agua" in English, "box" in
# Spanish), so this guard — not the dictionary alone — keeps a pool single-language.
_CROSS_LANGUAGE_MARGIN = 1.0


def _is_usable_word(word: str) -> bool:
    """
    Whether ``word`` is usable as a game word.

    ``isalpha`` drops multi-word/hyphenated/digit entries; the lowercase check
    drops proper nouns that kept their capital (wordfreq lowercases most, so the
    dictionary filter does the real proper-noun scrubbing).
    """
    return word.isalpha() and word == word.lower()


def _reads_as_other_language(word: str, lang: str, here_zipf: float) -> bool:
    """Whether ``word`` is markedly more frequent in another supported language."""
    for other in LANGUAGES:
        if other == lang or other not in available_languages():
            continue
        if zipf_frequency(word, other) - here_zipf > _CROSS_LANGUAGE_MARGIN:
            return True
    return False


def clean_candidates(lang: str, vocab_size: int) -> dict[str, float]:
    """
    Frequency-ranked, dictionary-clean, single-language candidate words → zipf.

    wordfreq supplies common words + zipf; ``simplemma.is_known`` keeps only real
    dictionary words for this language (dropping "john"/"juan"); the cross-language
    guard drops loanwords both dictionaries list but that read as the other
    language ("agua", "box").
    """
    candidates: dict[str, float] = {}
    seen: set[str] = set()
    for raw in top_n_list(lang, vocab_size):
        word = raw.strip()
        if not word or not _is_usable_word(word):
            continue
        folded = word.casefold()
        if folded in seen:
            continue
        here = zipf_frequency(word, lang)
        if here < DEFAULT_MIN_ZIPF:
            continue
        if not simplemma.is_known(word, lang):
            continue
        if _reads_as_other_language(word, lang, here):
            continue
        seen.add(folded)
        candidates[word] = here
    return candidates


def read_fasttext_vectors(path: str, wanted: set[str], dim: int) -> dict[str, np.ndarray]:
    """
    Stream a fastText ``.vec``/``.vec.gz`` file, returning vectors for ``wanted``.

    fastText files are one ``word f1 f2 ... fdim`` line per token, optionally
    prefixed by a ``"<count> <dim>"`` header. Streaming keeps memory flat: only
    the small wanted subset is retained, not the multi-million-row source.
    """
    found: dict[str, np.ndarray] = {}

    def _consume(line: str) -> None:
        parts = line.rstrip().split(" ")
        if len(parts) <= dim:
            return
        token = parts[0]
        if token not in wanted or token in found:
            return
        found[token] = np.asarray(parts[1 : dim + 1], dtype=np.float32)

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


def quantize_matrix(matrix: np.ndarray) -> tuple[np.ndarray, float]:
    """
    Quantize an L2-normalised (N, dim) float matrix to int8 plus a scale factor.

    ``127 / max|component|`` spreads the real value range across the full
    signed int8 range with zero clipping: unit-norm guarantees every component
    is in [-1, 1], so this scale can only ever be >= 127 (never smaller, so
    never causing a value to fall outside [-127, 127] before the round). A
    fixed scale of 127 would also never clip, but would waste most of the
    range — real fastText components run far below 1 in practice (~0.5 max
    observed on the real es pool), so the adaptive scale roughly doubles the
    effective resolution over a fixed one. Pure and side-effect free so it is
    unit-testable without a fastText source or the wordfreq/simplemma deps the
    rest of this module needs.
    """
    max_abs = float(np.abs(matrix).max()) if matrix.size else 1.0
    scale = 127.0 / max_abs if max_abs > 0 else 1.0
    quantized = np.clip(np.round(matrix * scale), -127, 127).astype(np.int8)
    return quantized, scale


def build_pool(lang: str, fasttext_path: str, *, vocab_size: int, dim: int) -> int:
    """
    Build and persist the language's pool. Returns the number of pooled words.

    Intersects the clean candidate words with those fastText has a vector for,
    L2-normalises, and writes ``backend/data/word_pool/{lang}.vN.npz`` (words,
    int8-quantized vectors + a scale factor, float16 zipf).

    int8 rather than float16: the backend keeps this matrix resident in RAM for
    the life of the process (one copy per worker), and int8 is a quarter the size
    of the float32 the backend used to widen float16 into — the single largest
    fixed memory cost in the API container. A unit-norm vector's components are
    always in [-1, 1], so quantizing against the matrix's own max absolute
    component (rather than a fixed 127) uses the full int8 range without ever
    clipping. Verified against the real es pool: top-10 nearest-neighbour overlap
    against the float32 original averages 9.9/10, and the game's relatedness is
    already deliberately loose (a seed only nudges the pool).
    """
    if lang not in LANGUAGES:
        raise ValueError(f"unsupported language {lang!r}")

    candidates = clean_candidates(lang, vocab_size)
    vectors = read_fasttext_vectors(fasttext_path, set(candidates), dim)

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

    matrix = np.asarray(rows, dtype=np.float32) if rows else np.zeros((0, dim), dtype=np.float32)
    quantized, scale = quantize_matrix(matrix)

    path = pool_path(lang)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    arrays = {
        NPZ_WORDS: np.asarray(words, dtype=object),
        NPZ_VECTORS: quantized,
        NPZ_SCALE: np.float32(scale),
        NPZ_ZIPF: np.asarray(zipfs, dtype=np.float16),
    }
    np.savez(path, **arrays)  # type: ignore[arg-type]  # numpy stub mistypes **kwds
    return len(words)
