"""
CLI: rebuild the per-language match maps into ``frontend/public/match-map``.

Reads the vector pools (build them first with ``build_vectors``) plus simplemma
and spaCy; needs no fastText.

    python -m build_match_map
    python -m build_match_map -l es
"""

from __future__ import annotations

import argparse

from contract import LANGUAGES, match_map_path
from matchmap import write_match_map


def main() -> None:
    parser = argparse.ArgumentParser(prog="build_match_map")
    parser.add_argument(
        "-l", "--language", choices=list(LANGUAGES), action="append",
        help="Language(s) to build (repeatable). Defaults to all.",
    )  # fmt: skip
    args = parser.parse_args()

    for lang in args.language or list(LANGUAGES):
        forms, groups = write_match_map(lang)
        print(f"{lang}: {forms} forms in {groups} groups -> {match_map_path(lang)}")


if __name__ == "__main__":
    main()
