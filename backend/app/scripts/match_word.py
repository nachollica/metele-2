"""
Eyeball the required-word match decision from the command line.

Run::

    uv run python -m app.scripts.match_word planes plane
    uv run python -m app.scripts.match_word planet plane --threshold 0.85

Prints the cosine similarity between the typed word and the required word, and
whether it clears the match threshold. Mirrors ``POST /words/match`` so you can
tune ``WORD_MATCH_THRESHOLD`` against real pairs without auth and HTTP.
"""

from __future__ import annotations

import argparse
import os

from app.word_engine import get_config, semantic_similarity


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="match_word",
        description="Score a typed word against a required word.",
    )
    parser.add_argument("word", help="The word the player typed.")
    parser.add_argument("required", help="The required word it should satisfy.")
    parser.add_argument(
        "-t",
        "--threshold",
        type=float,
        default=None,
        help="Cosine floor for a match (default: WORD_MATCH_THRESHOLD / config).",
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

    threshold = args.threshold if args.threshold is not None else get_config().match_threshold
    score = semantic_similarity(args.word, args.required)
    verdict = "MATCH" if score >= threshold else "no match"
    print(
        f"{args.word!r} vs {args.required!r}: score={score:.3f} threshold={threshold:.2f} -> {verdict}"
    )


if __name__ == "__main__":
    main()
