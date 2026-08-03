"""
The small, stable contract this tool shares with its two consumers.

There is intentionally no shared package: the word-assets tool is standalone, so
the few items below are duplicated in the code that READS the artifacts and MUST
be kept in sync. Counterparts:

- ``POOL_VERSION`` / ``pool_path`` / ``NPZ_*`` / ``DEFAULT_MIN_ZIPF`` mirror the
  backend reader in ``backend/app/word_engine.py`` (``_POOL_VERSION``,
  ``_pool_path``, ``_load_pool``, ``is_common``).
- ``MATCH_MAP_VERSION`` / ``match_map_path`` / :func:`normalize_for_match` mirror
  the frontend in ``frontend/lib/flowfic/match-map.ts`` and
  ``frontend/lib/flowfic/words.ts``.
- ``QUOTES_VERSION`` / ``quotes_path`` mirror the frontend quote loader in
  ``frontend/lib/flowfic/quotes.ts``. Only the version + path shape are shared;
  the soft-wrap normalizer that produces the stored text blocks is build-only
  (see ``src/quotes.py``), because the frontend renders the pre-normalized blocks
  verbatim and never needs it.
- ``INSPIRATION_VERSION`` / ``inspiration_path`` mirror the frontend inspiration
  loader in ``frontend/lib/flowfic/inspiration.ts``. Only the version + record
  shape (``{loc, img}``) are shared; parsing the film-grab sitemaps and deriving
  the display title from the ``loc`` slug are build-only / frontend-only
  respectively (see ``src/build_inspiration.py`` and ``inspiration.ts``).

These change ~never; when one does, bump it here and in the named counterpart.
"""

from __future__ import annotations

import os
import re
import unicodedata

# Languages we build for (mirror backend `Language` / frontend `Locale`).
LANGUAGES: tuple[str, ...] = ("en", "es")

# ---- word_pool artifact (consumed by the backend runtime) --------------

POOL_VERSION = 1
# Minimum wordfreq zipf a word must clear to enter the pool (backend's
# is_common uses the same default value).
DEFAULT_MIN_ZIPF = 2.5
# npz array keys — must match backend `_load_pool`.
NPZ_WORDS = "words"
NPZ_VECTORS = "vectors"
NPZ_ZIPF = "zipf"

# ---- match-map artifact (consumed by the frontend) ---------------------

MATCH_MAP_VERSION = 1

# ---- quotes artifact (consumed by the frontend, hand-curated) ----------
# Unlike the pool/match-map artifacts (large, generated, gitignored), the quotes
# file is small, hand-curated content and IS committed. Bump alongside
# QUOTES_VERSION in frontend/lib/flowfic/quotes.ts.

QUOTES_VERSION = 1

# ---- inspiration artifact (consumed by the frontend, generated) --------
# The film-grab image catalog: one JSON object per line (loc, img), parsed from
# film-grab's image sitemaps by ``src/build_inspiration.py``. Like
# the pool/match-map it is generated and gitignored (a full dump is large, and
# it is re-sliced freely), but unlike them it is a decorative, optional asset —
# the frontend degrades gracefully when it is absent. Bump alongside
# INSPIRATION_VERSION in frontend/lib/flowfic/inspiration.ts.

INSPIRATION_VERSION = 1


# ---- Output locations --------------------------------------------------


def _repo_root() -> str:
    """Repo root — this file lives at ``<repo>/word-assets/src/contract.py``."""
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def pool_path(lang: str) -> str:
    """``backend/data/word_pool/{lang}.vN.npz`` (matches backend ``_pool_path``)."""
    return os.path.join(_repo_root(), "backend", "data", "word_pool", f"{lang}.v{POOL_VERSION}.npz")


def match_map_path(lang: str) -> str:
    """``frontend/public/match-map/{lang}.vN.json`` (matches the frontend loader)."""
    return os.path.join(
        _repo_root(), "frontend", "public", "match-map", f"{lang}.v{MATCH_MAP_VERSION}.json"
    )


def quotes_path() -> str:
    """``frontend/public/quotes/quotes.vN.jsonl`` (matches the frontend loader)."""
    return os.path.join(
        _repo_root(), "frontend", "public", "quotes", f"quotes.v{QUOTES_VERSION}.jsonl"
    )


def inspiration_path() -> str:
    """``frontend/public/inspiration/images.vN.jsonl`` (matches the frontend loader)."""
    return os.path.join(
        _repo_root(),
        "frontend",
        "public",
        "inspiration",
        f"images.v{INSPIRATION_VERSION}.jsonl",
    )


def datasets_dir() -> str:
    """``word-assets/nlp_literature_datasets`` — the quote source corpus root."""
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "nlp_literature_datasets"
    )


# ---- Normalisation -----------------------------------------------------
# MUST mirror ``normalizeForMatch`` in frontend/lib/flowfic/words.ts so the
# match-map keys line up with what the frontend looks up.

_SPECIAL_LETTER_MAP = {
    "ł": "l", "ø": "o", "đ": "d", "ð": "d", "þ": "th", "ß": "ss",
    "æ": "ae", "œ": "oe", "ı": "i", "ħ": "h", "ŧ": "t", "ƀ": "b",
}  # fmt: skip
_SPECIAL_LETTER_RE = re.compile("[" + "".join(_SPECIAL_LETTER_MAP) + "]")
_COMBINING_RE = re.compile(r"[̀-ͯ]")


def normalize_for_match(text: str) -> str:
    """Lowercase, fold special letters, and strip diacritics (see words.ts)."""
    lowered = text.lower()
    replaced = _SPECIAL_LETTER_RE.sub(lambda m: _SPECIAL_LETTER_MAP[m.group()], lowered)
    decomposed = unicodedata.normalize("NFD", replaced)
    return _COMBINING_RE.sub("", decomposed)
