"""
Words API — HTTP layer over the WordNet logic in :mod:`app.wordnet`.

Two endpoints:

- ``POST /words/related`` expands user-supplied "category" seeds into a pool of
  related words.
- ``POST /words/random`` samples an unseeded random pool (used when the player
  enables required words but gives no categories).

Both resolve the language the same way and never default silently:

1. Explicit ``language`` field in the request body.
2. ``Accept-Language`` header — parsed with q-values, first supported wins.
3. Otherwise → 400.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import AcceptLanguageHeader, CurrentUser
from app.wordnet import Language, expand_related, parse_accept_language, random_words

router = APIRouter(prefix="/words", tags=["words"])


# ---- Schema ------------------------------------------------------------


class RelatedWordsRequest(BaseModel):
    words: list[str] = Field(..., min_length=1, max_length=50)
    language: Language | None = None
    # Bumped: with the BFS walking multiple relations per hop, 3 is the new
    # sweet spot — depth=2 produced thin pools for narrower seeds like
    # "fruit", and the limit still keeps responses bounded.
    depth: int = Field(default=3, ge=1, le=6)
    limit: int = Field(default=300, ge=1, le=2000)
    # Whether to follow holonym/meronym edges. Disabled gives a cleaner
    # taxonomic descent; enabled (default) gives a richer pool.
    include_partonomy: bool = True


class RelatedWordsResponse(BaseModel):
    language: Language
    words: list[str]


class RandomWordsRequest(BaseModel):
    language: Language | None = None
    limit: int = Field(default=300, ge=1, le=2000)


class RandomWordsResponse(BaseModel):
    language: Language
    words: list[str]


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
    summary="Expand category words into related words via WordNet.",
)
def related_words(
    payload: RelatedWordsRequest,
    _user: CurrentUser,
    accept_language: AcceptLanguageHeader = None,
) -> RelatedWordsResponse:
    language = _resolve_language(payload.language, accept_language)

    related = expand_related(
        payload.words,
        language,
        depth=payload.depth,
        limit=payload.limit,
        include_partonomy=payload.include_partonomy,
    )
    return RelatedWordsResponse(language=language, words=related)


@router.post(
    "/random",
    response_model=RandomWordsResponse,
    summary="Sample a pool of random words via WordNet.",
)
def random_words_route(
    payload: RandomWordsRequest,
    _user: CurrentUser,
    accept_language: AcceptLanguageHeader = None,
) -> RandomWordsResponse:
    language = _resolve_language(payload.language, accept_language)
    words = random_words(language, limit=payload.limit)
    return RandomWordsResponse(language=language, words=words)
