"""
Tests for the command line's argument wiring.

No command is executed here — these assert the shape of what the parser
produces, because a flag that silently defaults to the wrong host or the wrong
target is the kind of mistake that only shows up as load landing somewhere
unintended.
"""

from __future__ import annotations

import argparse

import pytest

from flowfic_stress.cli import _target_from, build_parser
from flowfic_stress.config import DEFAULT_TARGET_IP
from flowfic_stress.seeding import describe


def parse(argv: list[str]) -> argparse.Namespace:
    return build_parser().parse_args(argv)


class TestSeedCommand:
    def test_collects_repeated_seed_flags(self) -> None:
        args = parse(["seed", "--seed", "40,5", "--seed", "8,80"])
        assert args.seed == ["40,5", "8,80"]

    def test_requires_at_least_one_cohort(self) -> None:
        with pytest.raises(SystemExit):
            parse(["seed"])

    def test_defaults_to_the_production_host(self) -> None:
        assert parse(["seed", "--seed", "1,1"]).sut_host == "misty"


class TestCleanCommand:
    def test_neither_scope_is_supplied_by_default(self) -> None:
        # cmd_clean refuses this combination rather than defaulting to --all;
        # an unscoped delete should never be the thing that happens by accident.
        args = parse(["clean"])
        assert args.run_id is None
        assert args.all is False

    def test_accepts_an_explicit_run(self) -> None:
        assert parse(["clean", "--run-id", "20260826-2200"]).run_id == "20260826-2200"


class TestTargetResolution:
    def test_defaults_target_the_origin_not_the_cdn(self) -> None:
        # Going through the CDN has to be asked for: it caches static assets
        # and would leave the origin barely touched.
        target = _target_from(parse(["status"]))
        assert target.via_cdn is False
        assert target.ip == DEFAULT_TARGET_IP

    def test_target_ip_is_swappable_for_a_same_vcn_generator(self) -> None:
        target = _target_from(parse(["status", "--target-ip", "10.0.0.28"]))
        assert target.k6_hosts() == {"flowfic.app:443": "10.0.0.28:443"}

    def test_cdn_flag_drops_the_override(self) -> None:
        assert _target_from(parse(["status", "--via-cdn"])).k6_hosts() == {}

    def test_sut_host_is_independent_of_the_target_ip(self) -> None:
        # The box whose containers get inspected and the address load is sent
        # to are separate knobs; conflating them is how monitoring ends up
        # pointed at the wrong machine.
        args = parse(["status", "--target-ip", "10.0.0.28", "--sut-host", "newvm"])
        assert args.sut_host == "newvm"
        assert _target_from(args).ip == "10.0.0.28"


class TestDescribe:
    def test_summarises_a_tiered_population(self) -> None:
        from flowfic_stress.config import parse_cohorts

        line = describe(parse_cohorts(["40,5", "8,80"]))
        assert "48 users" in line
        assert "840 stories" in line
        assert "40x5" in line
