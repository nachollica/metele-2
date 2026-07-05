"""
Stories endpoints.

All routes require an authenticated user. Reads are scoped to the caller's
own stories; creates always set ``user_id`` to the caller.
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlmodel import desc, func, select

from app.db_models import Story
from app.dependencies import CurrentUser, DbSession
from app.models import StorySettings, StorySettingsStrict, StoryStats, StoryStatsStrict

router = APIRouter(prefix="/stories", tags=["stories"])


# ---- Schemas -------------------------------------------------------------


class StoryRead(BaseModel):
    """Public-facing story record."""

    id: int
    title: str | None
    text: str
    lang: str
    created_at: datetime
    user_id: str | None
    settings: StorySettings
    stats: StoryStats

    model_config = {"from_attributes": True}


class StoryCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    text: str = Field(..., min_length=1, max_length=200_000)
    lang: str = Field(..., min_length=2, max_length=8)
    settings: StorySettingsStrict
    stats: StoryStatsStrict


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
    db: DbSession,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
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
    db: DbSession,
    user: CurrentUser,
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
    db: DbSession,
    user: CurrentUser,
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
    db: DbSession,
    user: CurrentUser,
) -> StoryRead:
    row = Story(
        title=payload.title,
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


# ---- Delete ---------------------------------------------------------------


@router.delete(
    "/{story_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Hard-delete one of the caller's stories.",
)
def delete_story(
    story_id: int,
    db: DbSession,
    user: CurrentUser,
) -> Response:
    row = db.get(Story, story_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Story {story_id} not found.",
        )
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
