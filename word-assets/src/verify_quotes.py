"""
Verify the committed quote-of-the-day JSONL against its sources.

Fails loudly (non-zero exit) if any row is malformed, references a drifted source
(md5 mismatch), has out-of-range offsets, or whose stored source-language text no
longer matches the re-normalized raw slice. Wired as ``just quotes-verify``.
"""

from __future__ import annotations

import sys

from contract import quotes_path
from quotes import load_quotes, verify_quotes


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else quotes_path()
    try:
        count = len(load_quotes(path))
    except FileNotFoundError:
        print(f"ERROR: quotes file not found: {path}", file=sys.stderr)
        sys.exit(1)

    problems = verify_quotes(path)
    if problems:
        print(f"quotes-verify: {len(problems)} problem(s) in {path}\n", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        sys.exit(1)

    print(f"quotes-verify: OK — {count} quote(s) in {path}")


if __name__ == "__main__":
    main()
