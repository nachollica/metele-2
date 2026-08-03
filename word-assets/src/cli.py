"""
Small argparse helpers shared by the build CLIs.

``build_vectors`` and ``build_match_map`` both accept the same repeatable
``-l/--language`` option (constrained to :data:`contract.LANGUAGES`, defaulting
to all of them). Keep that one definition here so the two entry points cannot
drift apart.
"""

from __future__ import annotations

import argparse

from contract import LANGUAGES


def add_language_arg(parser: argparse.ArgumentParser) -> None:
    """Attach the shared repeatable ``-l/--language`` option to ``parser``."""
    parser.add_argument(
        "-l", "--language", choices=list(LANGUAGES), action="append",
        help="Language(s) to build (repeatable). Defaults to all.",
    )  # fmt: skip


def resolve_languages(args: argparse.Namespace) -> list[str]:
    """The selected languages, or every known language when none were passed."""
    return args.language or list(LANGUAGES)
