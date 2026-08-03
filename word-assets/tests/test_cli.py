"""Tests for the shared build-CLI argparse helpers."""

from __future__ import annotations

import argparse

import pytest

from cli import add_language_arg, resolve_languages
from contract import LANGUAGES


def _parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    add_language_arg(parser)
    return parser.parse_args(argv)


def test_defaults_to_all_languages() -> None:
    assert resolve_languages(_parse([])) == list(LANGUAGES)


def test_repeated_flag_collects_the_subset() -> None:
    assert resolve_languages(_parse(["-l", "es", "--language", "en"])) == ["es", "en"]


def test_rejects_unknown_language() -> None:
    with pytest.raises(SystemExit):
        _parse(["-l", "fr"])
