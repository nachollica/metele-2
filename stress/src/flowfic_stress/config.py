"""
Run configuration: what to point at, how hard to push, and what to seed.

Everything here is a pure function over strings, which is deliberate — it is
the only part of the harness that can be unit-tested without a server, so the
parsing that decides how much load lands on production lives here rather than
inline in the CLI.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
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


# ---- Journey mix -------------------------------------------------------

# The five journeys, traced from the frontend's actual call sites rather than
# from the route list — what a real visit triggers, in the order it triggers it.
JOURNEYS: tuple[str, ...] = ("anon", "landing", "sprint", "stories", "finish")

# Defaults reflect how the game is actually used: a sprint runs 5-45 minutes
# with *zero* backend traffic, so starts and saves are rare next to page loads,
# and every save is preceded by a start that happened minutes earlier.
DEFAULT_MIX: dict[str, int] = {
    "anon": 60,
    "landing": 20,
    "sprint": 10,
    "stories": 7,
    "finish": 3,
}


def parse_mix(raws: list[str]) -> dict[str, int]:
    """
    Parse repeated ``--mix journey=weight`` into the full weight table.

    Unspecified journeys keep their default weight, so dialling one knob does
    not silently zero the rest. Weights are relative, not percentages — the
    arrival rate is set separately by ``--rate``, and normalising here would
    make ``--mix sprint=0`` behave differently depending on what else was
    passed.
    """
    mix = dict(DEFAULT_MIX)
    for raw in raws:
        name, sep, value = raw.partition("=")
        name = name.strip()
        if not sep:
            raise ValueError(f"Invalid --mix {raw!r}: expected JOURNEY=WEIGHT (e.g. sprint=25).")
        if name not in JOURNEYS:
            raise ValueError(f"Unknown journey {name!r}. Known: {', '.join(JOURNEYS)}.")
        try:
            weight = int(value.strip())
        except ValueError as exc:
            raise ValueError(f"Invalid --mix {raw!r}: weight must be an integer.") from exc
        if weight < 0:
            raise ValueError(f"Invalid --mix {raw!r}: weight cannot be negative.")
        mix[name] = weight
    if sum(mix.values()) <= 0:
        raise ValueError("Every journey weight is zero — there would be no load to generate.")
    return mix


# ---- Profiles ----------------------------------------------------------

# The standard load-test shapes. Each is a list of (duration, rate-multiple)
# stages fed to k6's ramping-arrival-rate executor; ``--rate`` scales the
# multiples into real arrivals per second.
PROFILES: dict[str, list[tuple[str, float]]] = {
    # Does the plumbing work at all? Not a measurement.
    "smoke": [("20s", 0.2), ("20s", 0.2)],
    # Expected steady traffic, held long enough for memory to settle.
    "load": [("2m", 1.0), ("5m", 1.0), ("1m", 0.0)],
    # Past expected traffic, to find where latency and errors turn.
    "stress": [("2m", 1.0), ("3m", 2.0), ("3m", 3.0), ("1m", 0.0)],
    # A sudden crowd, then back to nothing — recovery matters as much as peak.
    "spike": [("30s", 0.5), ("1m", 6.0), ("2m", 0.5), ("30s", 0.0)],
    # Long and flat: leaks and swap creep only show up over time.
    "soak": [("2m", 1.0), ("60m", 1.0), ("2m", 0.0)],
    # Climb until the error budget breaks, then stop.
    "breakpoint": [("1m", 1.0), ("10m", 10.0)],
}

DEFAULT_PROFILE = "smoke"


def profile_stages(profile: str) -> list[tuple[str, float]]:
    try:
        return PROFILES[profile]
    except KeyError:
        raise ValueError(
            f"Unknown profile {profile!r}. Known: {', '.join(sorted(PROFILES))}."
        ) from None


# ---- Targets and hosts -------------------------------------------------

# The public hostname is always what k6 sends as Host/SNI, whichever IP it is
# routed to — Caddy's site block matches on it, and the bare-IP :443 vhost
# aborts anything that arrives without it.
PUBLIC_HOST = "flowfic.app"

# misty's public address. A generator inside the same VCN would point at the
# private one instead; nothing else about the run changes, which is the reason
# this is a single value rather than a mode.
DEFAULT_TARGET_IP = "129.153.7.91"

# Where load is generated from. Anywhere with k6 and an ssh config entry works;
# same-region matters far more than size, because RTT sets the floor on every
# measurement (~1ms from Oracle iad, ~180ms from a laptop).
DEFAULT_LOAD_HOST = "mario"
# Kept separate so a browser's memory and CPU never compete with the load
# generator's on the same box.
DEFAULT_CANARY_HOST = "luigi"

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


@dataclass(frozen=True)
class RunConfig:
    """One invocation's full settings."""

    run_id: str
    profile: str = DEFAULT_PROFILE
    rate: float = 5.0
    lang: str = "es"
    mix: dict[str, int] = field(default_factory=lambda: dict(DEFAULT_MIX))
    target: Target = field(default_factory=Target)
    load_host: str = DEFAULT_LOAD_HOST
    canary_host: str = DEFAULT_CANARY_HOST
    sut_host: str = DEFAULT_SUT_HOST
    sut_path: str = DEFAULT_SUT_PATH

    def k6_env(self, *, dev_token: str, user_count: int) -> str:
        """
        The JSON blob handed to k6 as FLOWFIC_CONFIG.

        Everything k6 needs is resolved here, so the scenario files parse flags
        nowhere and this stays the single place a run's shape is decided.
        """
        return json.dumps(
            {
                "runId": self.run_id,
                "baseUrl": self.target.base_url,
                "hosts": self.target.k6_hosts(),
                "lang": self.lang,
                "rate": self.rate,
                "stages": profile_stages(self.profile),
                "mix": self.mix,
                "devToken": dev_token,
                "userCount": user_count,
            }
        )
