"""
Exercise the related-words expansion from the command line.

Run::

    uv run python -m app.scripts.related_words kitchen food
    uv run python -m app.scripts.related_words animal --language es --limit 30

Positional arguments are the seed "category" words. The script reuses the same
``expand_related`` logic that backs ``POST /words/related`` (embedding neighbours
of each seed, unioned and filtered by wordfreq) and prints the resulting pool,
one word per line. Handy for eyeballing what a given seed and language produce
without going through auth and HTTP.

The embedding model is chosen by id — ``--model`` here, or ``WORD_EMBEDDINGS_*``
in the service — never hardcoded, so any sentence-transformers model can be
swapped in. The matrices are read from (or built into) ``WORD_EMBEDDINGS_DIR``.
"""

from __future__ import annotations

import argparse
import os

from app.word_engine import DEFAULT_MIN_ZIPF, Language, expand_related


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="related_words",
        description="Expand seed words into related words via embeddings.",
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
            "Minimum wordfreq zipf score a word must clear to be kept "
            f"(default: {DEFAULT_MIN_ZIPF}). Lower keeps rarer words."
        ),
    )
    parser.add_argument(
        "-m",
        "--model",
        default=None,
        help="Embedding model id (overrides WORD_EMBEDDINGS_MODEL / size default).",
    )
    args = parser.parse_args()

    if args.model:
        os.environ["WORD_EMBEDDINGS_MODEL"] = args.model

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
