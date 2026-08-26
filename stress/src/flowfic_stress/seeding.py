"""
Creating and removing the synthetic population a run needs.

Seeding runs *inside* the API container, driven by a script piped to its
interpreter. That container already holds the models, the engine and the
database credentials, so the harness needs none of them — and nothing is
written into the production image, which is the reason this is not simply
another module under ``backend/app/scripts``.

Every row carries the ``lt_`` prefix (see :mod:`.config`), which is what makes
cleanup a filter rather than a diff against a remembered list.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from flowfic_stress.config import (
    USER_PREFIX,
    Cohort,
    run_like_pattern,
    total_stories,
    total_users,
    validate_run_id,
)
from flowfic_stress.remote import docker_exec_python, psql

# Spread seeded stories across this many days back from now. Streaks, the
# "this week" window and the 7-day chart are all computed from `created_at`, so
# stories stamped at one instant would leave every gamification endpoint
# measuring a degenerate case that no real account can reach.
HISTORY_DAYS = 90


@dataclass(frozen=True)
class SeedSummary:
    users_created: int
    stories_created: int


# The script that does the work, executed by the container's own interpreter.
# It is a template rather than an importable module because it has to run in a
# process that has never heard of this package.
_SEED_SCRIPT = """
import json, random, sys
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.db import engine, init_db
from app.db_models import Story, User
from app.models import StorySettings, StoryStats

spec = json.loads({spec!r})
run_id = spec["run_id"]
cohorts = spec["cohorts"]
history_days = spec["history_days"]
prefix = spec["prefix"]

# Seeded so a re-run with the same run id produces the same population.
rng = random.Random(run_id)

LOREM = (
    "the light fell across the table and nothing in the room moved for a while "
    "she wrote until the words stopped meaning anything and then kept going "
    "somewhere below a door closed twice and the building settled into itself "
    "he counted the seconds between one thought and the next and lost the thread "
)


def story_text(words):
    out = []
    pool = LOREM.split()
    while len(out) < words:
        out.append(rng.choice(pool))
    return " ".join(out)


init_db()

users_created = 0
stories_created = 0
index = 0

with Session(engine) as session:
    for cohort in cohorts:
        for _ in range(cohort["users"]):
            index += 1
            uid = f"{{prefix}}{{run_id}}_{{index}}"
            if session.get(User, uid) is not None:
                continue
            now = datetime.now(timezone.utc)
            session.add(
                User(
                    id=uid,
                    email=f"{{uid}}@loadtest.invalid",
                    name=f"Load Test {{index}}",
                    picture=None,
                    created_at=now - timedelta(days=history_days),
                    updated_at=now,
                )
            )
            # Commit the user before its stories rather than letting one flush
            # order both: stories carry a foreign key to users.id, and batching
            # the two together has the insert reach the database first.
            session.commit()
            users_created += 1

            for _ in range(cohort["stories"]):
                words = rng.randint(80, 420)
                duration_ms = rng.choice([300, 600, 900, 1500, 2700]) * 1000
                # Bias toward recent days so the trailing week is never empty:
                # the weekly totals and the 7-day chart are the widest surface
                # on the progress screen, and an all-old population would leave
                # them zeroed while the lifetime scan still did its full work.
                age_days = min(
                    rng.randint(0, history_days),
                    rng.randint(0, history_days),
                )
                created = now - timedelta(
                    days=age_days,
                    hours=rng.randint(0, 23),
                    minutes=rng.randint(0, 59),
                )
                session.add(
                    Story(
                        title=None if rng.random() < 0.4 else f"Session {{stories_created + 1}}",
                        text=story_text(words),
                        lang=rng.choice(["es", "en"]),
                        created_at=created,
                        user_id=uid,
                        settings=StorySettings(
                            idleTimerEnabled=True,
                            mainTimerSeconds=rng.choice([5, 8, 10]),
                            globalTimerSeconds=duration_ms // 1000,
                            requiredWordIntervalEnabled=True,
                            requiredWordIntervalSeconds=rng.choice([20, 30, 45]),
                            requiredWordUseTimerEnabled=True,
                            requiredWordUseTimerSeconds=rng.choice([20, 30, 60]),
                            soundEnabled=True,
                            soundMode="bell",
                            wordSource="free",
                            wordSourceSeeds="",
                        ),
                        stats=StoryStats(
                            reason=rng.choice(["global-timeout", "manual", "idle-timeout"]),
                            durationMs=duration_ms,
                            characters=words * 6,
                            words=words,
                            requiredWordsUsed=rng.randint(0, 25),
                        ),
                    )
                )
                stories_created += 1

            # Commit per user so a large population streams into the database
            # instead of building one enormous transaction in a container that
            # has very little memory to spare.
            session.commit()

print(json.dumps({{"users": users_created, "stories": stories_created}}))
"""


def seed(host: str, run_id: str, cohorts: list[Cohort]) -> SeedSummary:
    """Create the run's users and their stories inside the API container."""
    validate_run_id(run_id)
    spec = json.dumps(
        {
            "run_id": run_id,
            "prefix": USER_PREFIX,
            "history_days": HISTORY_DAYS,
            "cohorts": [{"users": c.users, "stories": c.stories} for c in cohorts],
        }
    )
    script = _SEED_SCRIPT.format(spec=spec)
    raw = docker_exec_python(host, "flowfic-api", script)
    # The script prints one JSON line last; anything before it is noise from
    # the container (SQLAlchemy warnings, for instance).
    payload = json.loads(raw.splitlines()[-1])
    return SeedSummary(users_created=payload["users"], stories_created=payload["stories"])


def count_rows(host: str, run_id: str | None) -> tuple[int, int]:
    """How many synthetic users and stories currently exist."""
    pattern = run_like_pattern(run_id)
    sql = (
        f"SELECT (SELECT count(*) FROM users WHERE id LIKE '{pattern}' ESCAPE '\\'), "
        f"(SELECT count(*) FROM stories WHERE user_id LIKE '{pattern}' ESCAPE '\\');"
    )
    raw = psql(host, sql)
    users, stories = raw.split("|")
    return int(users), int(stories)


def clean(host: str, run_id: str | None) -> tuple[int, int]:
    """
    Delete the synthetic rows, stories first (they carry the FK to users).

    The pattern is built by :func:`run_like_pattern`, which only ever produces
    a ``lt_``-anchored filter — there is no code path here that can be handed a
    pattern matching a real account. The guard below restates that at the point
    of deletion, because this statement runs against the production database.
    """
    pattern = run_like_pattern(run_id)
    if not pattern.startswith(USER_PREFIX.replace("_", "\\_")):
        raise ValueError(f"Refusing to delete with non-load-test pattern {pattern!r}.")

    before_users, before_stories = count_rows(host, run_id)
    sql = (
        f"DELETE FROM stories WHERE user_id LIKE '{pattern}' ESCAPE '\\'; "
        f"DELETE FROM users WHERE id LIKE '{pattern}' ESCAPE '\\';"
    )
    psql(host, sql)
    after_users, after_stories = count_rows(host, run_id)
    if after_users or after_stories:
        raise RuntimeError(f"Cleanup left {after_users} users and {after_stories} stories behind.")
    return before_users, before_stories


def describe(cohorts: list[Cohort]) -> str:
    """One line summarising what a cohort list will create."""
    tiers = ", ".join(f"{c.users}x{c.stories}" for c in cohorts)
    return f"{total_users(cohorts)} users / {total_stories(cohorts)} stories ({tiers})"
