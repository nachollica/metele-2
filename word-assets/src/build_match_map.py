"""
CLI: rebuild the per-language match maps into ``frontend/public/match-map``.

Reads the vector pools (build them first with ``build_vectors``) plus simplemma
and spaCy; needs no fastText.

    python -m build_match_map
    python -m build_match_map -l es
"""

from __future__ import annotations

import argparse

from cli import add_language_arg, resolve_languages
from contract import match_map_path
from matchmap import write_match_map


def main() -> None:
    parser = argparse.ArgumentParser(prog="build_match_map")
    add_language_arg(parser)
    args = parser.parse_args()

    for lang in resolve_languages(args):
        forms, groups = write_match_map(lang)
        print(f"{lang}: {forms} forms in {groups} groups -> {match_map_path(lang)}")


if __name__ == "__main__":
    main()
