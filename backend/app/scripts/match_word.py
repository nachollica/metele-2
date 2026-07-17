"""
Show the required-word match decision for every pair among a list of words.

Run::

    uv run python -m app.scripts.match_word plane planes planet
    uv run python -m app.scripts.match_word palo pala palos palas -l es

Takes two or more words and prints one row per unordered pair, in combination
order — for ``A B C D`` that is ``A B``, ``A C``, ``A D``, ``B C``, ``B D``,
``C D``. Columns are the two words and whether they match. Mirrors
``POST /words/match``.

``-l/--language`` selects the lemmatizer and defaults to ``en``; it can sit
anywhere among the words.
"""

from __future__ import annotations

import argparse
from itertools import combinations

from app.word_engine import Language
from app.word_match import is_match


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="match_word",
        description="Decide, for every pair of words, whether they are the same word inflected.",
    )
    parser.add_argument(
        "words",
        nargs="+",
        metavar="WORD",
        help="Two or more words to compare pairwise.",
    )
    parser.add_argument(
        "-l",
        "--language",
        choices=[lang.value for lang in Language],
        default=Language.EN.value,
        help="Language for lemmatisation (default: en).",
    )
    # ``parse_intermixed_args`` lets ``-l`` sit anywhere among the variadic words.
    args = parser.parse_intermixed_args()

    if len(args.words) < 2:
        parser.error("need at least two words to form a pair")
    language = Language(args.language)

    rows = [(a, b, is_match(a, b, language)) for a, b in combinations(args.words, 2)]
    word_w = max(len(w) for row in rows for w in (row[0], row[1]))
    for a, b, ok in rows:
        print(f"{a:<{word_w}}  {b:<{word_w}}  {'match' if ok else '-'}")


if __name__ == "__main__":
    main()
