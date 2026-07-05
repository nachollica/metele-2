"""
Exercise the related-words expansion from the command line.

Run::

    uv run python -m app.scripts.related_words kitchen food
    uv run python -m app.scripts.related_words animal --language es --limit 30

Positional arguments are the seed "category" words. The script reuses the same
``expand_related`` logic that backs ``POST /words/related`` and prints the
resulting pool (a random sample), one word per line. Handy for eyeballing what
a given seed and language produce without going through auth and HTTP.
"""

from __future__ import annotations

import argparse

from app.wordnet import DEFAULT_MIN_ZIPF, Language, expand_related


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="related_words",
        description="Expand seed words into related words via WordNet.",
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
        "-d",
        "--depth",
        type=int,
        default=3,
        help="How many WordNet edges to walk from each seed (default: 3).",
    )
    parser.add_argument(
        "-f",
        "--min-frequency",
        type=float,
        default=DEFAULT_MIN_ZIPF,
        help=(
            "Minimum wordfreq zipf score a word must clear to be kept "
            f"(default: {DEFAULT_MIN_ZIPF}). Lower keeps rarer words."
        ),
    )
    parser.add_argument(
        "--no-partonomy",
        dest="include_partonomy",
        action="store_false",
        help=(
            "Skip holonym/meronym edges (e.g. petal/stem for flower) for a "
            "cleaner taxonomic descent. Mirrors `include_partonomy` on "
            "POST /words/related; the default follows them."
        ),
    )
    args = parser.parse_args()

    words = expand_related(
        args.words,
        Language(args.language),
        depth=args.depth,
        limit=args.limit,
        include_partonomy=args.include_partonomy,
        min_zipf=args.min_frequency,
    )
    for word in words:
        print(word)


if __name__ == "__main__":
    main()
