"""
Candidate slicer — curation input for the quote-of-the-day file.

Prints paragraph-sized spans of a source file with their exact character
offsets, normalized preview, and a heuristic ``kind``. A curator (human or
agent) reads these and copies the offsets of the good ones into
``frontend/public/quotes/quotes.vN.jsonl`` — offsets come straight from this
tool, never eyeballed, so :func:`quotes.verify_quotes` always lines up.

Usage (paths are relative to ``word-assets/nlp_literature_datasets``)::

    # List paragraph candidates, longest first, with offsets + preview:
    uv run python src/slice_quotes.py "direct_requests/Lewis Carroll/Alice in Wonderland/content.txt"

    # Preview one exact slice (e.g. a dialogue run you want to select):
    uv run python src/slice_quotes.py "<rel/path>" --start 12345 --end 12500

The ``--start/--end`` mode prints the md5 and the normalized blocks for the exact
offsets you would record — a dry run of one JSONL row.
"""

from __future__ import annotations

import argparse
import json

from quotes import (
    classify,
    iter_paragraphs,
    md5_of_file,
    normalize_quote,
    read_source,
    resolve_source,
)

# Candidate length window (characters) — skip fragments and whole chapters.
_MIN_CHARS = 60
_MAX_CHARS = 600
_PREVIEW_CHARS = 160


def _list_candidates(rel_path: str, min_chars: int, max_chars: int, limit: int) -> None:
    text = read_source(rel_path)
    print(f"# {rel_path}")
    print(f"# md5: {md5_of_file(resolve_source(rel_path))}  chars: {len(text)}\n")
    paragraphs = [p for p in iter_paragraphs(text) if min_chars <= len(p.text) <= max_chars]
    paragraphs.sort(key=lambda p: len(p.text), reverse=True)
    for para in paragraphs[:limit]:
        preview = " ".join(para.blocks)
        if len(preview) > _PREVIEW_CHARS:
            preview = preview[:_PREVIEW_CHARS] + "…"
        print(f"[{para.char_start}:{para.char_end}] ({para.kind}, {len(para.text)}c) {preview}")


def _preview_slice(rel_path: str, start: int, end: int) -> None:
    text = read_source(rel_path)
    blocks = normalize_quote(text[start:end])
    row = {
        "kind": classify(blocks),
        "lang_source": "en",
        "origin": {
            "file": rel_path,
            "md5": md5_of_file(resolve_source(rel_path)),
            "char_start": start,
            "char_end": end,
        },
        "text": {"en": blocks},
    }
    print(json.dumps(row, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Slice quote candidates from a source file.")
    parser.add_argument("file", help="source path relative to nlp_literature_datasets/")
    parser.add_argument("--start", type=int, help="preview one exact slice: start offset")
    parser.add_argument("--end", type=int, help="preview one exact slice: end offset")
    parser.add_argument("--min-chars", type=int, default=_MIN_CHARS)
    parser.add_argument("--max-chars", type=int, default=_MAX_CHARS)
    parser.add_argument("--limit", type=int, default=40, help="max candidates to list")
    args = parser.parse_args()

    if args.start is not None and args.end is not None:
        _preview_slice(args.file, args.start, args.end)
    else:
        _list_candidates(args.file, args.min_chars, args.max_chars, args.limit)


if __name__ == "__main__":
    main()
