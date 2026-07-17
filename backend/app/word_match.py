"""
Required-word matching: is a typed word an inflection of the required word?

The frontend pre-filters on spelling (edit distance), then asks the backend to
decide whether a syntactically-similar pair is *the same word* — "planes" should
satisfy "plane", but "planet" should not. This is a lemma question, not a
semantic-similarity one: sentence/word embeddings conflate "same lemma" with
"looks/means alike", so they happily match "pala"/"palos". A dictionary
lemmatizer instead reduces each word to its base form and compares.

Approach (per language, QA'd on ~130 ES/EN pairs at perfect precision — no
look-alike ever matches — and ~0.95 recall):

- Lemmatize both words with simplemma and compare the lemmas.
- Fall back to a regular-plural rule, because simplemma leaves some ``-es``
  plurals (flor/flores, luz/luces) at their surface form. The rule is applied to
  the surface words and to the lemmas.

The residual misses are a few verb conjugations and adjective gender (alto/alta),
which cannot be recovered by a blunt rule without also matching genuine
look-alikes like pala/palo — so we accept them.

Kept free of HTTP/DB/auth coupling like :mod:`app.word_engine`; imported by the
``/words/match`` route and the ``match_word`` CLI.
"""

from __future__ import annotations

import simplemma

from app.word_engine import Language


def lemma(word: str, language: Language) -> str:
    """The base form of ``word`` for ``language`` (lowercased); input on miss."""
    cleaned = word.strip().casefold()
    if not cleaned:
        return ""
    return simplemma.lemmatize(cleaned, lang=language.value).casefold()


def _is_regular_plural(a: str, b: str, language: Language) -> bool:
    """Whether one of ``a``/``b`` is the other's regular plural."""
    short, long = sorted((a, b), key=len)
    if not short or short == long:
        return False
    if long in (short + "s", short + "es"):
        return True
    if language is Language.ES:
        # luz → luces, pez → peces
        return short.endswith("z") and long == short[:-1] + "ces"
    # English: baby → babies, leaf → leaves, knife → knives
    if short.endswith("y") and long == short[:-1] + "ies":
        return True
    if short.endswith("fe") and long == short[:-2] + "ves":
        return True
    return short.endswith("f") and long == short[:-1] + "ves"


def is_match(word_a: str, word_b: str, language: Language) -> bool:
    """
    Whether ``word_a`` is the required word ``word_b`` (or an inflection of it).

    Symmetric. Empty inputs never match. Matches when the two share a lemma, or
    when one is the regular plural of the other (checked on both the surface
    forms and the lemmas).
    """
    a = word_a.strip().casefold()
    b = word_b.strip().casefold()
    if not a or not b:
        return False
    if a == b:
        return True
    la, lb = lemma(a, language), lemma(b, language)
    if la and la == lb:
        return True
    return _is_regular_plural(a, b, language) or _is_regular_plural(la, lb, language)
