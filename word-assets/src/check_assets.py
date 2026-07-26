"""
CLI: verify every expected word artifact exists, exiting non-zero if not.

A convenience mirror of the per-build guards (backend Docker + frontend
prebuild), handy before a deploy: ``just word-assets::check``.
"""

from __future__ import annotations

import os
import sys

from contract import LANGUAGES, match_map_path, pool_path


def main() -> None:
    missing = [
        path
        for lang in LANGUAGES
        for path in (pool_path(lang), match_map_path(lang))
        if not os.path.exists(path)
    ]
    if missing:
        print("Missing word artifacts (build them with `just word-assets::vectors` + `match-map`):")
        for path in missing:
            print(f"  {path}")
        sys.exit(1)
    print(f"All word artifacts present for: {', '.join(LANGUAGES)}")


if __name__ == "__main__":
    main()
