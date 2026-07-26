"""
Exercise the related-words expansion from the command line.

Run::

    uv run python -m app.scripts.related_words kitchen food
    uv run python -m app.scripts.related_words animal --language es --limit 30

Positional arguments are the seed "category" words. The script reuses the same
``expand_related`` logic that backs ``POST /words/related`` (fastText neighbours
of each seed, diluted with random pool words) and prints the resulting pool, one
word per line. Handy for eyeballing what a given seed and language produce
without going through auth and HTTP.

The vector pools are read from ``WORD_DATA_DIR`` (or the packaged
``backend/data``); build them first with ``app.scripts.build_vectors``.
"""

from __future__ import annotations

import argparse

from app.word_engine import DEFAULT_MIN_ZIPF, Language, expand_related


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="related_words",
        description="Expand seed words into a loosely-related game word pool.",
    )
    parser.add_argument(
        "words",
        nargs="+",
        metavar="WORD",
        help="Seed category words to expand (e.g. kitchen food).",
    )
    parser.add_argument(
        "-l",
        "--language",
        choices=[lang.value for lang in Language],
        default=Language.EN.value,
        help="Game language for lookup and output (default: en).",
    )
    parser.add_argument(
        "-n",
        "--limit",
        type=int,
        default=100,
        help="Cap on the number of related words returned (default: 100).",
    )
    parser.add_argument(
        "-f",
        "--min-frequency",
        type=float,
        default=DEFAULT_MIN_ZIPF,
        help=(
            "Minimum zipf score a word must clear to be kept "
            f"(default: {DEFAULT_MIN_ZIPF}). The pool is baked at {DEFAULT_MIN_ZIPF}, "
            "so this can only raise the floor."
        ),
    )
    args = parser.parse_args()

    words = expand_related(
        args.words,
        Language(args.language),
        limit=args.limit,
        min_zipf=args.min_frequency,
    )
    for word in words:
        print(word)


if __name__ == "__main__":
    main()
