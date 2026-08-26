"""
Tests for the run configuration.

This is the only part of the harness that can be exercised without a server,
and it is also the part that decides how much load lands on production and
which rows cleanup will delete — so it is tested closely.
"""

from __future__ import annotations

import pytest

from flowfic_stress.config import (
    USER_PREFIX,
    Cohort,
    Target,
    new_run_id,
    parse_cohort,
    parse_cohorts,
    run_like_pattern,
    total_stories,
    total_users,
    user_id,
    validate_run_id,
)

# ---- Cohorts -----------------------------------------------------------


class TestParseCohort:
    def test_parses_users_and_stories(self) -> None:
        assert parse_cohort("40,5") == Cohort(users=40, stories=5)

    def test_tolerates_surrounding_space(self) -> None:
        assert parse_cohort(" 8 , 80 ") == Cohort(users=8, stories=80)

    def test_allows_users_with_no_stories(self) -> None:
        # A fresh account is a real population member: it exercises the
        # gamification endpoints' empty path, which is a different code path
        # from the scan over a full history.
        assert parse_cohort("10,0") == Cohort(users=10, stories=0)

    @pytest.mark.parametrize("raw", ["40", "40,5,2", "", "x,5", "40,y"])
    def test_rejects_malformed_values(self, raw: str) -> None:
        with pytest.raises(ValueError):
            parse_cohort(raw)

    @pytest.mark.parametrize("raw", ["0,5", "-1,5"])
    def test_rejects_empty_cohorts(self, raw: str) -> None:
        with pytest.raises(ValueError, match="USERS must be at least 1"):
            parse_cohort(raw)

    def test_rejects_negative_story_counts(self) -> None:
        with pytest.raises(ValueError, match="cannot be negative"):
            parse_cohort("5,-1")


class TestCohortTotals:
    def test_sums_a_tiered_population(self) -> None:
        cohorts = parse_cohorts(["40,5", "8,80", "2,300"])
        assert total_users(cohorts) == 50
        assert total_stories(cohorts) == 40 * 5 + 8 * 80 + 2 * 300

    def test_preserves_order(self) -> None:
        cohorts = parse_cohorts(["1,1", "2,2"])
        assert [c.users for c in cohorts] == [1, 2]


# ---- Run ids and cleanup patterns --------------------------------------


class TestRunId:
    def test_generated_ids_validate(self) -> None:
        assert validate_run_id(new_run_id())

    @pytest.mark.parametrize(
        "bad",
        [
            "a",  # too short
            "-leading",  # must start alphanumeric
            "has space",
            "has_underscore",  # would split the id from the index in a user id
            "UPPER",
            "with%wildcard",
            "quote'; DROP TABLE users;--",
        ],
    )
    def test_rejects_ids_that_could_break_the_filter(self, bad: str) -> None:
        # The id lands inside a LIKE pattern and inside remote commands, so
        # anything that could change the meaning of either is refused here.
        with pytest.raises(ValueError):
            validate_run_id(bad)


class TestLikePattern:
    def test_scopes_to_one_run(self) -> None:
        pattern = run_like_pattern("20260826-2200")
        assert pattern == r"lt\_20260826-2200\_%"

    def test_covers_every_run_when_unscoped(self) -> None:
        assert run_like_pattern(None) == r"lt\_%"

    def test_escapes_the_prefix_underscore(self) -> None:
        # `_` matches any single character in LIKE. Unescaped, `lt_%` would
        # also match a real account whose id happened to start "lt" plus one
        # character — the pattern has to mean the literal prefix.
        assert r"\_" in run_like_pattern(None)

    def test_rejects_an_invalid_run_id(self) -> None:
        with pytest.raises(ValueError):
            run_like_pattern("bad id")

    def test_user_ids_match_their_own_run_pattern(self) -> None:
        run = "20260826-2200"
        generated = user_id(run, 3)
        assert generated.startswith(USER_PREFIX)
        # Mirror LIKE semantics: strip the escapes, then compare literally.
        prefix = run_like_pattern(run).replace("\\", "").rstrip("%")
        assert generated.startswith(prefix)

    def test_one_run_pattern_does_not_match_another_run(self) -> None:
        prefix = run_like_pattern("20260826-2200").replace("\\", "").rstrip("%")
        assert not user_id("20260827-0100", 1).startswith(prefix)


# ---- Target routing ----------------------------------------------------


class TestTarget:
    def test_routes_the_public_host_to_the_origin_ip(self) -> None:
        target = Target(ip="10.0.0.28")
        # The Host header stays flowfic.app, which is what Caddy's site block
        # matches on — the bare-IP vhost aborts anything arriving without it.
        assert target.k6_hosts() == {"flowfic.app:443": "10.0.0.28:443"}
        assert target.base_url == "https://flowfic.app"

    def test_cdn_mode_leaves_dns_alone(self) -> None:
        assert Target(via_cdn=True).k6_hosts() == {}

    def test_browser_gets_its_own_resolver_override(self) -> None:
        # Chromium ignores k6's hosts option, so the same redirect has to be
        # restated as a command-line flag or the canary silently hits the CDN.
        args = Target(ip="10.0.0.28").chromium_resolver_args()
        assert args == ["--host-resolver-rules=MAP flowfic.app 10.0.0.28"]

    def test_browser_override_is_dropped_in_cdn_mode(self) -> None:
        assert Target(via_cdn=True).chromium_resolver_args() == []
