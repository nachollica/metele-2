"""Stories endpoints.

All routes require an authenticated user. Reads are scoped to the caller's
own stories; creates always set ``user_id`` to the caller.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlmodel import Session, desc, func, select

from ..auth import get_current_user
from ..db import get_db
from ..db_models import Story, User


router = APIRouter(prefix="/stories", tags=["stories"])


# ---- Schemas -------------------------------------------------------------


class StoryRead(BaseModel):
    """Public-facing story record."""

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


class StoryCount(BaseModel):
    count: int


# ---- List -----------------------------------------------------------------


@router.get(
    "",
    response_model=StoryListResponse,
    summary="List the caller's recent stories (newest first), paginated.",
)
def list_stories(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StoryListResponse:
    total_stmt = select(func.count()).select_from(Story).where(Story.user_id == user.id)
    total = db.exec(total_stmt).one()

    items_stmt = (
        select(Story)
        .where(Story.user_id == user.id)
        .order_by(desc(Story.created_at), desc(Story.id))
        .offset(offset)
        .limit(limit)
    )
    rows = db.exec(items_stmt).all()
    return StoryListResponse(
        items=[StoryRead.model_validate(row) for row in rows],
        total=int(total),
        limit=limit,
        offset=offset,
    )


# ---- Count ----------------------------------------------------------------


@router.get(
    "/count",
    response_model=StoryCount,
    summary="Total number of stories owned by the caller.",
)
def count_stories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StoryCount:
    stmt = select(func.count()).select_from(Story).where(Story.user_id == user.id)
    return StoryCount(count=int(db.exec(stmt).one()))


# ---- Detail ---------------------------------------------------------------


@router.get(
    "/{story_id}",
    response_model=StoryRead,
    summary="Fetch one of the caller's stories by id.",
)
def get_story(
    story_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StoryRead:
    row = db.get(Story, story_id)
    if row is None or row.user_id != user.id:
        # 404 (not 403) on cross-owner access — don't leak existence of
        # other users' rows.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Story {story_id} not found.",
        )
    return StoryRead.model_validate(row)


# ---- Create ---------------------------------------------------------------


@router.post(
    "",
    response_model=StoryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new story owned by the caller.",
)
def create_story(
    payload: StoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StoryRead:
    row = Story(
        text=payload.text,
        lang=payload.lang,
        settings=payload.settings,
        stats=payload.stats,
        user_id=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return StoryRead.model_validate(row)
