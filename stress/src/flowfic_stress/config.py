"""
Run configuration: what to point at, how hard to push, and what to seed.

Everything here is a pure function over strings, which is deliberate — it is
the only part of the harness that can be unit-tested without a server, so the
parsing that decides how much load lands on production lives here rather than
inline in the CLI.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime

# ---- Identity ----------------------------------------------------------

# Every row the harness writes carries this prefix. Cleanup matches on it and
# refuses to run against anything else, so a mistyped filter deletes nothing
# rather than deleting a real account. Real users are Auth0 subs
# (``google-oauth2|1165…``), which cannot collide with it.
USER_PREFIX = "lt_"

_RUN_ID_RE = re.compile(r"^[0-9a-z][0-9a-z-]{2,30}$")


def new_run_id() -> str:
    """A UTC timestamp, sortable and unique enough for one operator."""
    return datetime.now(tz=UTC).strftime("%Y%m%d-%H%M%S")


def validate_run_id(run_id: str) -> str:
    """
    Reject a run id that could smuggle a SQL wildcard or a shell metacharacter
    into the cleanup filter. The id is interpolated into a LIKE pattern and
    into remote commands, so this is the boundary that keeps both safe.
    """
    if not _RUN_ID_RE.match(run_id):
        raise ValueError(
            f"Invalid run id {run_id!r}: use 3-31 chars of [a-z0-9-], starting alphanumeric."
        )
    return run_id


def user_id(run_id: str, index: int) -> str:
    """The synthetic username for one seeded user."""
    return f"{USER_PREFIX}{run_id}_{index}"


def run_like_pattern(run_id: str | None) -> str:
    """
    The SQL LIKE pattern selecting this run's rows, or every run's when
    ``run_id`` is None. ``_`` is a single-character wildcard in LIKE, so the
    literal underscores in the prefix are escaped; callers pair this with
    ``ESCAPE '\\'``.
    """
    if run_id is None:
        return USER_PREFIX.replace("_", r"\_") + "%"
    return USER_PREFIX.replace("_", r"\_") + validate_run_id(run_id) + r"\_%"


# ---- Cohorts -----------------------------------------------------------


@dataclass(frozen=True)
class Cohort:
    """``users`` synthetic accounts, each holding ``stories`` finished stories."""

    users: int
    stories: int


def parse_cohort(raw: str) -> Cohort:
    """
    Parse one ``--seed N,M`` value: N users with M stories each.

    Repeating the flag builds a population out of tiers, which is the point —
    ``--seed 40,5 --seed 8,80 --seed 2,300`` is a realistic long tail, while
    ``--seed 50,50`` is a flat one. The gamification endpoints scan every story
    a user owns, so the shape of this distribution is what decides whether a
    run exercises that scan or skips past it.
    """
    parts = raw.split(",")
    if len(parts) != 2:
        raise ValueError(f"Invalid --seed {raw!r}: expected USERS,STORIES (e.g. 40,5).")
    try:
        users, stories = (int(p.strip()) for p in parts)
    except ValueError as exc:
        raise ValueError(f"Invalid --seed {raw!r}: both values must be integers.") from exc
    if users < 1:
        raise ValueError(f"Invalid --seed {raw!r}: USERS must be at least 1.")
    if stories < 0:
        raise ValueError(f"Invalid --seed {raw!r}: STORIES cannot be negative.")
    return Cohort(users=users, stories=stories)


def parse_cohorts(raws: list[str]) -> list[Cohort]:
    """Parse every ``--seed`` occurrence, preserving order."""
    return [parse_cohort(raw) for raw in raws]


def total_users(cohorts: list[Cohort]) -> int:
    return sum(c.users for c in cohorts)


def total_stories(cohorts: list[Cohort]) -> int:
    return sum(c.users * c.stories for c in cohorts)


# ---- Targets and hosts -------------------------------------------------

# The public hostname is always what k6 sends as Host/SNI, whichever IP it is
# routed to — Caddy's site block matches on it, and the bare-IP :443 vhost
# aborts anything that arrives without it.
PUBLIC_HOST = "flowfic.app"

# misty's public address. A generator inside the same VCN would point at the
# private one instead; nothing else about the run changes, which is the reason
# this is a single value rather than a mode.
DEFAULT_TARGET_IP = "129.153.7.91"

# The host under test, and where its containers and monitoring live.
DEFAULT_SUT_HOST = "misty"
DEFAULT_SUT_PATH = ".0/flowfic"

CONTAINERS: tuple[str, ...] = ("flowfic-api", "flowfic-db", "flowfic-caddy")


@dataclass(frozen=True)
class Target:
    """Where the load lands."""

    host: str = PUBLIC_HOST
    ip: str = DEFAULT_TARGET_IP
    # Through Cloudflare instead of straight at the origin. Off by default:
    # the edge caches every static asset, so the origin would see a fraction of
    # the traffic, and a high arrival rate from one IP is exactly what CF's
    # rate rules exist to stop.
    via_cdn: bool = False

    @property
    def base_url(self) -> str:
        return f"https://{self.host}"

    def k6_hosts(self) -> dict[str, str]:
        """
        k6's ``hosts`` option, which reroutes the connection without touching
        the Host header — so the request still presents as ``flowfic.app`` and
        Caddy's site block still matches. Empty when going through the CDN,
        where normal DNS is the point.
        """
        if self.via_cdn:
            return {}
        return {f"{self.host}:443": f"{self.ip}:443"}

    def chromium_resolver_args(self) -> list[str]:
        """
        The same override for the browser canary. Chromium has its own
        resolver and ignores k6's ``hosts`` entirely, so the redirect has to be
        restated as a command-line flag.
        """
        if self.via_cdn:
            return []
        return [f"--host-resolver-rules=MAP {self.host} {self.ip}"]
