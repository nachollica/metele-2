"""
Show the required-word match decision for every pair among a list of words.

Run::

    uv run python -m app.scripts.match_word plane planes planet
    uv run python -m app.scripts.match_word palo pala palos palas -l es

Takes two or more words and prints one row per unordered pair, in combination
order — for ``A B C D`` that is ``A B``, ``A C``, ``A D``, ``B C``, ``B D``,
``C D``. Columns are the two words, their lemmas (which explain the verdict), and
whether they match. Mirrors ``POST /words/match``.

``-l/--language`` selects the lemmatizer and defaults to ``en``; it can sit
anywhere among the words.
"""

from __future__ import annotations

import argparse
from itertools import combinations

from app.word_engine import Language
from app.word_match import is_match, lemma


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
    # ``parse_intermixed_args`` lets ``-l`` sit anywhere around the variadic words.
    args = parser.parse_intermixed_args()

    if len(args.words) < 2:
        parser.error("need at least two words to form a pair")
    language = Language(args.language)

    rows = [
        (a, b, lemma(a, language), lemma(b, language), is_match(a, b, language))
        for a, b in combinations(args.words, 2)
    ]
    word_w = max(len(w) for row in rows for w in (row[0], row[1]))
    lemma_w = max(len(w) for row in rows for w in (row[2], row[3]))
    for a, b, la, lb, ok in rows:
        verdict = "match" if ok else "-"
        print(f"{a:<{word_w}}  {b:<{word_w}}  {la:<{lemma_w}} {lb:<{lemma_w}}  {verdict}")


if __name__ == "__main__":
    main()
