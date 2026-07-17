"""
Words API — HTTP layer over the embedding word logic in :mod:`app.word_engine`.

Three endpoints:

- ``POST /words/related`` expands user-supplied "category" seeds into a pool of
  related words.
- ``POST /words/random`` samples an unseeded random pool (used when the player
  enables required words but gives no categories).
- ``POST /words/match`` judges whether a typed word is a close enough match for a
  required word (the frontend pre-filters on spelling; the backend decides
  meaning, so "planes" matches "plane" but "planet" does not).

All resolve the language the same way and never default silently:

1. Explicit ``language`` field in the request body.
2. ``Accept-Language`` header — parsed with q-values, first supported wins.
3. Otherwise → 400.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import AcceptLanguageHeader, CurrentUser
from app.word_engine import (
    Language,
    expand_related,
    get_config,
    parse_accept_language,
    random_words,
    semantic_similarity,
)

router = APIRouter(prefix="/words", tags=["words"])


# ---- Schema ------------------------------------------------------------


class RelatedWordsRequest(BaseModel):
    words: list[str] = Field(..., min_length=1, max_length=50)
    language: Language | None = None
    limit: int = Field(default=300, ge=1, le=2000)


class RelatedWordsResponse(BaseModel):
    language: Language
    words: list[str]


class RandomWordsRequest(BaseModel):
    language: Language | None = None
    limit: int = Field(default=300, ge=1, le=2000)


class RandomWordsResponse(BaseModel):
    language: Language
    words: list[str]


class MatchRequest(BaseModel):
    # The word the player typed and the required word it should satisfy.
    word: str = Field(..., min_length=1, max_length=100)
    required: str = Field(..., min_length=1, max_length=100)
    language: Language | None = None


class MatchResponse(BaseModel):
    language: Language
    valid: bool
    score: float


# ---- Route -------------------------------------------------------------


def _resolve_language(explicit: Language | None, accept_language: str | None) -> Language:
    """Pick the request language or fail with a 400 (we never default silently)."""
    language = explicit or parse_accept_language(accept_language)
    if language is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Could not determine language. Provide it via the request "
                "body `language` field or the `Accept-Language` header. "
                f"Supported: {', '.join(sorted(lang.value for lang in Language))}."
            ),
        )
    return language


@router.post(
    "/related",
    response_model=RelatedWordsResponse,
    summary="Expand category words into related words via embeddings.",
)
def related_words(
    payload: RelatedWordsRequest,
    _user: CurrentUser,
    accept_language: AcceptLanguageHeader = None,
) -> RelatedWordsResponse:
    language = _resolve_language(payload.language, accept_language)

    related = expand_related(payload.words, language, limit=payload.limit)
    return RelatedWordsResponse(language=language, words=related)


@router.post(
    "/random",
    response_model=RandomWordsResponse,
    summary="Sample a pool of random words.",
)
def random_words_route(
    payload: RandomWordsRequest,
    _user: CurrentUser,
    accept_language: AcceptLanguageHeader = None,
) -> RandomWordsResponse:
    language = _resolve_language(payload.language, accept_language)
    words = random_words(language, limit=payload.limit)
    return RandomWordsResponse(language=language, words=words)


@router.post(
    "/match",
    response_model=MatchResponse,
    summary="Judge whether a typed word semantically matches a required word.",
)
def match_word(
    payload: MatchRequest,
    _user: CurrentUser,
    accept_language: AcceptLanguageHeader = None,
) -> MatchResponse:
    language = _resolve_language(payload.language, accept_language)
    score = semantic_similarity(payload.word, payload.required)
    return MatchResponse(
        language=language,
        valid=score >= get_config().match_threshold,
        score=score,
    )
