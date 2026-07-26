"""
CLI: rebuild the per-language vector pools into ``backend/data/word_pool``.

The fastText source files must be present locally (they are read once here and
are never shipped). Download the mono-lingual Common Crawl vectors from
https://fasttext.cc/docs/en/crawl-vectors.html (``cc.en.300.vec.gz``,
``cc.es.300.vec.gz``).

    python -m build_vectors --fasttext-dir ~/fasttext
    python -m build_vectors -l es --fasttext ~/fasttext/cc.es.300.vec.gz
"""

from __future__ import annotations

import argparse
import os

from contract import LANGUAGES, pool_path
from pool import build_pool

_DEFAULT_PATTERN = "cc.{lang}.300.vec.gz"
_DEFAULT_VOCAB = 60_000
_DEFAULT_DIM = 300


def _resolve_path(lang: str, args: argparse.Namespace) -> str:
    if args.fasttext:
        return args.fasttext
    base = args.fasttext_dir or os.environ.get("WORD_FASTTEXT_DIR")
    if not base:
        raise SystemExit(
            "No fastText source. Pass --fasttext <file> (single language) or "
            "--fasttext-dir <dir> / WORD_FASTTEXT_DIR (with cc.<lang>.300.vec.gz files)."
        )
    return os.path.join(base, args.pattern.format(lang=lang))


def main() -> None:
    parser = argparse.ArgumentParser(prog="build_vectors")
    parser.add_argument(
        "-l", "--language", choices=list(LANGUAGES), action="append",
        help="Language(s) to build (repeatable). Defaults to all.",
    )  # fmt: skip
    parser.add_argument("--fasttext", default=None, help="Single language's fastText file.")
    parser.add_argument("--fasttext-dir", default=None, help="Dir of fastText files (--pattern).")
    parser.add_argument("--pattern", default=_DEFAULT_PATTERN, help=f"Default: {_DEFAULT_PATTERN}.")
    parser.add_argument("--vocab-size", type=int, default=_DEFAULT_VOCAB)
    parser.add_argument("--dim", type=int, default=_DEFAULT_DIM)
    args = parser.parse_args()

    languages = args.language or list(LANGUAGES)
    if args.fasttext and len(languages) != 1:
        parser.error("--fasttext takes a single file; pass exactly one -l with it.")

    for lang in languages:
        path = _resolve_path(lang, args)
        print(f"{lang}: reading {path} ...")
        count = build_pool(lang, path, vocab_size=args.vocab_size, dim=args.dim)
        print(f"{lang}: {count} words -> {pool_path(lang)}")


if __name__ == "__main__":
    main()
