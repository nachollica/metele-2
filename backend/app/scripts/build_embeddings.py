"""
Precompute the per-language embedding matrices for the related-words engine.

Run::

    uv run python -m app.scripts.build_embeddings
    uv run python -m app.scripts.build_embeddings --language es --language fr
    uv run python -m app.scripts.build_embeddings --model <sentence-transformers-id>

Downloads the model and encodes each language's scrubbed candidate vocabulary
into a normalised matrix, persisting it under ``WORD_EMBEDDINGS_DIR``. The
service and the Docker image load these instead of encoding tens of thousands of
words at boot.

Model, size, directory, and vocab size all come from ``WORD_EMBEDDINGS_*``
environment variables (see ``app.word_engine._config_from_env``); ``--model``
and ``--size`` are convenience overrides.
"""

from __future__ import annotations

import argparse
import os

from app.word_engine import LANGUAGES, Language, build_matrix


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="build_embeddings",
        description="Precompute and cache the related-words embedding matrices.",
    )
    parser.add_argument(
        "-l",
        "--language",
        choices=[lang.value for lang in Language],
        action="append",
        help="Language(s) to build (repeatable). Defaults to all hardcoded languages.",
    )
    parser.add_argument(
        "-m",
        "--model",
        default=None,
        help="Embedding model id (overrides WORD_EMBEDDINGS_MODEL).",
    )
    parser.add_argument(
        "-s",
        "--size",
        choices=["small", "large"],
        default=None,
        help="Footprint tier when no explicit model id is given.",
    )
    args = parser.parse_args()

    if args.model:
        os.environ["WORD_EMBEDDINGS_MODEL"] = args.model
    if args.size:
        os.environ["WORD_EMBEDDINGS_SIZE"] = args.size

    languages = [Language(code) for code in args.language] if args.language else list(LANGUAGES)
    for language in languages:
        words, vectors = build_matrix(language)
        print(f"{language.value}: {len(words)} words, matrix {vectors.shape} cached.")


if __name__ == "__main__":
    main()
