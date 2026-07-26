"""
Precompute the per-language vector pools for the related-words engine.

Run (fastText source files must be present locally — they are read once here and
are *not* shipped; only the small ``.npz`` output is committed)::

    uv run python -m app.scripts.build_vectors --fasttext-dir ~/fasttext
    uv run python -m app.scripts.build_vectors -l es --fasttext ~/fasttext/cc.es.300.vec.gz

For each language it builds the clean candidate pool (wordfreq frequency list
intersected with the language's simplemma dictionary, which strips proper nouns
and guarantees single-language content), keeps the words fastText has a vector
for, L2-normalises, and writes ``data/word_pool/{lang}.vN.npz``.

Download the mono-lingual fastText vectors from
https://fasttext.cc/docs/en/crawl-vectors.html (``cc.en.300.vec.gz``,
``cc.es.300.vec.gz``). Per-language files mean no cross-language leakage.

Build knobs come from ``WORD_POOL_VOCAB_SIZE`` / ``WORD_VECTORS_DIM`` (or the
flags below); the output directory is ``WORD_DATA_DIR`` or the packaged
``backend/data``.
"""

from __future__ import annotations

import argparse
import os

from app.word_engine import (
    LANGUAGES,
    Language,
    WordConfig,
    build_pool,
    configure,
    default_data_dir,
)

# Default filename pattern for the official fastText Common Crawl vectors.
_DEFAULT_PATTERN = "cc.{lang}.300.vec.gz"


def _resolve_path(language: Language, args: argparse.Namespace) -> str:
    """Locate the fastText file for ``language`` from the flags/env."""
    if args.fasttext:
        return args.fasttext
    base = args.fasttext_dir or os.environ.get("WORD_FASTTEXT_DIR")
    if not base:
        raise SystemExit(
            "No fastText source. Pass --fasttext <file> (single language) or "
            "--fasttext-dir <dir> / WORD_FASTTEXT_DIR (with cc.<lang>.300.vec.gz files)."
        )
    return os.path.join(base, args.pattern.format(lang=language.value))


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="build_vectors",
        description="Precompute and cache the related-words vector pools.",
    )
    parser.add_argument(
        "-l",
        "--language",
        choices=[lang.value for lang in Language],
        action="append",
        help="Language(s) to build (repeatable). Defaults to all supported languages.",
    )
    parser.add_argument(
        "--fasttext",
        default=None,
        help="Path to a single language's fastText .vec/.vec.gz (use with one -l).",
    )
    parser.add_argument(
        "--fasttext-dir",
        default=None,
        help="Directory of fastText files named by --pattern (or set WORD_FASTTEXT_DIR).",
    )
    parser.add_argument(
        "--pattern",
        default=_DEFAULT_PATTERN,
        help=f"Filename pattern within --fasttext-dir (default: {_DEFAULT_PATTERN}).",
    )
    parser.add_argument(
        "--vocab-size", type=int, default=None, help="Override WORD_POOL_VOCAB_SIZE."
    )
    parser.add_argument(
        "--dim", type=int, default=None, help="fastText dimensionality (default 300)."
    )
    args = parser.parse_args()

    languages = [Language(code) for code in args.language] if args.language else list(LANGUAGES)
    if args.fasttext and len(languages) != 1:
        parser.error("--fasttext takes a single file; pass exactly one -l with it.")

    configure(
        WordConfig(
            data_dir=os.environ.get("WORD_DATA_DIR") or default_data_dir(),
            vocab_size=args.vocab_size or int(os.environ.get("WORD_POOL_VOCAB_SIZE", "60000")),
            dim=args.dim or int(os.environ.get("WORD_VECTORS_DIM", "300")),
        )
    )

    for language in languages:
        path = _resolve_path(language, args)
        print(f"{language.value}: reading {path} ...")
        words, matrix = build_pool(language, path)
        print(f"{language.value}: {len(words)} words, matrix {matrix.shape} cached.")


if __name__ == "__main__":
    main()
