"""Related-words endpoint backed by WordNet.

Given a list of "category" words (e.g. ``["animal", "fruit"]``), expand them to
a flat list of related words by walking each input's WordNet hyponyms (more
specific concepts). The frontend will use this to grow the pool the game draws
its required words from.

Language resolution order (we never silently default to English):

1. Explicit ``language`` field in the request body.
2. ``Accept-Language`` header — parsed with q-values, first supported wins.
3. Otherwise → 400.

NLTK ships nothing by default. The ``ensure_corpora`` helper downloads
``wordnet`` + ``omw-1.4`` (Open Multilingual WordNet — needed for Spanish
lemmas) on first call and caches the result. Tests can monkey-patch it to a
no-op when the corpora are already on disk.
"""

from __future__ import annotations

import re
import threading
from enum import Enum

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/words", tags=["words"])


# ---- Language ----------------------------------------------------------


class Language(str, Enum):
    """Supported game languages. Values match the frontend ``[lang]`` segment
    (``en`` / ``es``) so the same identifier flows end-to-end."""

    EN = "en"
    ES = "es"

    @property
    def wordnet_code(self) -> str:
        """The 3-letter code WordNet/OMW expects."""
        return _WORDNET_CODES[self]


_WORDNET_CODES: dict[Language, str] = {
    Language.EN: "eng",
    Language.ES: "spa",
}


# ---- Accept-Language parsing -------------------------------------------


_TAG_RE = re.compile(r"^\s*([A-Za-z]{2,3})(?:-[A-Za-z0-9]+)?\s*$")


def parse_accept_language(header: str | None) -> Language | None:
    """Pick the first supported language from ``Accept-Language``.

    The header is a comma-separated list of tags, each optionally suffixed with
    ``;q=<weight>`` (default weight 1.0). Tags with weight 0 mean "explicitly
    not acceptable" and are skipped. Order matters: we sort by weight desc, and
    return the first tag whose primary subtag matches one of our supported
    languages. ``None`` means "no acceptable supported language found".
    """
    if not header:
        return None

    candidates: list[tuple[float, int, str]] = []
    for index, raw in enumerate(header.split(",")):
        part = raw.strip()
        if not part:
            continue
        tag, _, params = part.partition(";")
        weight = 1.0
        for param in params.split(";"):
            param = param.strip()
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
        # Stable sort: higher weight first, then header order.
        candidates.append((-weight, index, match.group(1).lower()))

    candidates.sort()
    for _, _, primary in candidates:
        try:
            return Language(primary)
        except ValueError:
            continue
    return None


# ---- WordNet bootstrap -------------------------------------------------


_corpora_lock = threading.Lock()
_corpora_ready = False


def ensure_corpora() -> None:
    """Download WordNet + OMW corpora once per process, idempotently.

    We call ``nltk.download`` with ``quiet=True`` so a freshly cloned dev box
    bootstraps itself the first time the endpoint is hit, but a CI run with
    pre-seeded data is a no-op.
    """
    global _corpora_ready
    if _corpora_ready:
        return
    with _corpora_lock:
        if _corpora_ready:
            return
        import nltk

        nltk.download("wordnet", quiet=True)
        nltk.download("omw-1.4", quiet=True)
        _corpora_ready = True


# ---- Word expansion ----------------------------------------------------


def _clean_lemma(name: str) -> str:
    """OMW lemmas are underscore-joined for multi-word entries — turn them
    back into normal phrases. Also strip any whitespace."""
    return name.replace("_", " ").strip()


# Single-token check: matches one run of word characters (Unicode letters,
# digits, underscore) with no whitespace, hyphens, apostrophes, etc.
_SINGLE_TOKEN_RE = re.compile(r"^\w+$", re.UNICODE)


def _is_single_token(word: str) -> bool:
    """Whether `word` is a single contiguous token usable as a required word.

    NOTE: This intentionally THROWS AWAY multi-word lemmas (e.g. "fire engine",
    "ice cream") and hyphenated/apostrophed entries (e.g. "self-control",
    "o'clock"). Reason: the frontend's "did the user just type the required
    word?" check only looks at the last finished word — it can't recognize
    multi-token requireds. Including them here would surface words the player
    can never satisfy. We accept the smaller pool as the cost of correctness.
    """
    return bool(_SINGLE_TOKEN_RE.match(word))


def expand_related(
    words: list[str],
    language: Language,
    *,
    depth: int,
    limit: int,
) -> list[str]:
    """Collect related words by walking the hyponym closure of each input.

    - Drops duplicates and the input words themselves (case-insensitive).
    - Order is deterministic: alphabetical, so callers get a stable response.
    - ``depth`` bounds how many hyponym levels we descend (1 = direct only).
    - ``limit`` truncates the final result.
    """
    ensure_corpora()
    from nltk.corpus import wordnet as wn

    excluded = {w.strip().casefold() for w in words if w.strip()}
    code = language.wordnet_code

    collected: set[str] = set()
    for raw in words:
        word = raw.strip()
        if not word:
            continue
        for synset in wn.synsets(word, lang=code):
            for hyponym in synset.closure(lambda s: s.hyponyms(), depth=depth):
                for lemma in hyponym.lemma_names(code):
                    cleaned = _clean_lemma(lemma)
                    if not cleaned or cleaned.casefold() in excluded:
                        continue
                    # NOTE: drop multi-token / hyphenated entries. See
                    # `_is_single_token` for the rationale (frontend only
                    # matches single finished words). Yes, this discards
                    # otherwise-valid lemmas like "ice cream" — by design.
                    if not _is_single_token(cleaned):
                        continue
                    collected.add(cleaned)

    ordered = sorted(collected, key=str.casefold)
    return ordered[:limit]


# ---- Schema ------------------------------------------------------------


class RelatedWordsRequest(BaseModel):
    words: list[str] = Field(..., min_length=1, max_length=50)
    language: Language | None = None
    depth: int = Field(default=2, ge=1, le=5)
    limit: int = Field(default=100, ge=1, le=500)


class RelatedWordsResponse(BaseModel):
    language: Language
    words: list[str]


# ---- Route -------------------------------------------------------------


# TODO(auth): require an authenticated user once the auth flow is in place.
# Left intentionally open for now so end-to-end testing of the categories
# feature can run without a session token. To enable, add
# ``user: AuthUser = Depends(get_current_user)`` to the signature below.
@router.post(
    "/related",
    response_model=RelatedWordsResponse,
    summary="Expand category words into related words via WordNet hyponyms.",
)
def related_words(
    payload: RelatedWordsRequest,
    accept_language: str | None = Header(default=None),
) -> RelatedWordsResponse:
    language = payload.language or parse_accept_language(accept_language)
    if language is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Could not determine language. Provide it via the request "
                "body `language` field or the `Accept-Language` header. "
                f"Supported: {', '.join(sorted(lang.value for lang in Language))}."
            ),
        )

    related = expand_related(
        payload.words,
        language,
        depth=payload.depth,
        limit=payload.limit,
    )
    return RelatedWordsResponse(language=language, words=related)
