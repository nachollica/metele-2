"""
Required-word matching: is a typed word an inflection of the required word?

The frontend pre-filters on spelling (edit distance), then asks the backend to
decide whether a syntactically-similar pair is *the same word* — "planes" should
satisfy "plane", but "planet" should not. This is a lemma question, not a
semantic-similarity one: word embeddings conflate "same lemma" with "looks/means
alike", so they happily match "pala"/"palos". Two dictionary lemmatizers instead
reduce each word to its base form and compare.

Why two? They are complementary (QA'd on ~180 ES/EN pairs at perfect precision —
no distinct-noun look-alike ever matches):

- simplemma catches animate-noun gender (gato→gato, so gato/gata match) but
  leaves adjective gender alone (alta stays "alta").
- spaCy tags "alta" as an adjective and lemmatises it to "alto", so alto/alta
  match — but it treats gata as its own noun lemma.

Neither ever collapses genuinely different nouns (palo/pala, puerto/puerta), so
their union recovers both gender kinds while keeping look-alikes apart. A
regular-plural rule fills the remaining gaps (flor/flores, luz/luces).

spaCy is heavy (the pipeline, thinc, and two ~55MB models), and its answer for a
given surface word never changes. So it is run **at build time** over the pool
(see the ``build_lemma_maps`` script) and its lemmas are baked into a compact
``lemma_maps/{lang}.json``. At runtime we do a dict lookup instead — no spaCy.
This replays spaCy's decision for every pooled word (which covers the common
forms players actually type); a form absent from the map degrades to no-match
rather than a false positive, so precision is preserved.

Kept free of HTTP/DB/auth coupling like :mod:`app.word_engine`; imported by the
``/words/match`` route and the ``match_word`` CLI.
"""

from __future__ import annotations

import json
import os
import threading

import simplemma

from app.word_engine import Language, get_config

# Bump alongside the build script when the map format/inputs change.
_LEMMA_MAP_VERSION = 1

# Guards lazy loading of the per-language maps.
_map_lock = threading.Lock()
_map_cache: dict[tuple[str, Language], dict[str, str]] = {}


def _map_path(data_dir: str, language: Language) -> str:
    return os.path.join(data_dir, "lemma_maps", f"{language.value}.v{_LEMMA_MAP_VERSION}.json")


def _lemma_map(language: Language) -> dict[str, str]:
    """
    The precomputed spaCy-lemma map for ``language`` (casefolded surface → lemma).

    Absent artifact → empty map (the spaCy path simply contributes nothing, and
    matching falls back to simplemma + the plural rule).
    """
    data_dir = get_config().data_dir
    key = (data_dir, language)
    cached = _map_cache.get(key)
    if cached is not None:
        return cached
    with _map_lock:
        cached = _map_cache.get(key)
        if cached is not None:
            return cached
        path = _map_path(data_dir, language)
        mapping: dict[str, str] = {}
        if os.path.exists(path):
            with open(path, encoding="utf-8") as handle:
                mapping = {str(k): str(v) for k, v in json.load(handle).items()}
        _map_cache[key] = mapping
        return mapping


def preload(languages: tuple[Language, ...]) -> None:
    """Warm the lemma maps and simplemma at startup so the first match isn't slow."""
    for language in languages:
        _lemma_map(language)
        # Touch simplemma so its language data is resident before the first call.
        simplemma.lemmatize("a", lang=language.value)


def _mapped_lemma(word: str, language: Language) -> str:
    """The baked spaCy lemma of ``word`` (casefolded); the word itself if unmapped."""
    folded = word.casefold()
    return _lemma_map(language).get(folded, folded)


def lemma(word: str, language: Language) -> str:
    """The simplemma base form of ``word`` (lowercased); input on a miss."""
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

    Symmetric. Empty inputs never match. Matches when the two share a lemma under
    *either* simplemma (noun gender) or the baked spaCy map (adjective gender),
    or when one is the regular plural of the other (checked on the surface forms
    and the simplemma lemmas).
    """
    a = word_a.strip().casefold()
    b = word_b.strip().casefold()
    if not a or not b:
        return False
    if a == b:
        return True

    sa, sb = lemma(a, language), lemma(b, language)
    if sa and sa == sb:
        return True
    if _mapped_lemma(a, language) == _mapped_lemma(b, language):
        return True
    return _is_regular_plural(a, b, language) or _is_regular_plural(sa, sb, language)
