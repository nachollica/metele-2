"""Stories endpoints.

For now both list (GET) and create (POST) are unauthenticated and operate on
records with ``user_id = NULL``. Once the frontend's auth flow is wired
through, this module will switch to the standard ``Depends(get_current_user)``
pattern and write/read the caller's records.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlmodel import Session, desc, func, select

from ..db import get_db
from ..db_models import Story


router = APIRouter(prefix="/stories", tags=["stories"])


# ---- Schemas -------------------------------------------------------------


class StoryRead(BaseModel):
    """Public-facing story record. Mirrors the SQLModel row but is decoupled
    so we can shape the wire format independently of the table."""

    id: int
    text: str
    lang: str
    created_at: datetime
    user_id: str | None
    settings: dict[str, Any]
    stats: dict[str, Any]

    model_config = {"from_attributes": True}


class StoryCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=200_000)
    lang: str = Field(..., min_length=2, max_length=8)
    settings: dict[str, Any] = Field(default_factory=dict)
    stats: dict[str, Any] = Field(default_factory=dict)


class StoryListResponse(BaseModel):
    items: list[StoryRead]
    total: int
    limit: int
    offset: int


# ---- List -----------------------------------------------------------------


# TODO(auth): once we want per-user filtering, add
#   ``user: AuthUser = Depends(get_current_user)`` and
#   ``stmt = stmt.where(Story.user_id == user.id)``.
@router.get(
    "",
    response_model=StoryListResponse,
    summary="List recent stories (newest first), paginated.",
)
def list_stories(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> StoryListResponse:
    total_stmt = select(func.count()).select_from(Story)
    total = db.exec(total_stmt).one()

    items_stmt = (
        select(Story).order_by(desc(Story.created_at), desc(Story.id)).offset(offset).limit(limit)
    )
    rows = db.exec(items_stmt).all()
    return StoryListResponse(
        items=[StoryRead.model_validate(row) for row in rows],
        total=int(total),
        limit=limit,
        offset=offset,
    )


# ---- Detail ---------------------------------------------------------------


@router.get(
    "/{story_id}",
    response_model=StoryRead,
    summary="Fetch a single story by id.",
)
def get_story(story_id: int, db: Session = Depends(get_db)) -> StoryRead:
    row = db.get(Story, story_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Story {story_id} not found.",
        )
    return StoryRead.model_validate(row)


# ---- Create ---------------------------------------------------------------


# TODO(auth): once auth is mandatory here, take ``user: AuthUser = Depends(...)``
# and persist ``user_id=user.id``. Today every record lands with NULL owner.
@router.post(
    "",
    response_model=StoryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new story (anonymous for now — owner=NULL).",
)
def create_story(payload: StoryCreate, db: Session = Depends(get_db)) -> StoryRead:
    row = Story(
        text=payload.text,
        lang=payload.lang,
        settings=payload.settings,
        stats=payload.stats,
        user_id=None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return StoryRead.model_validate(row)
