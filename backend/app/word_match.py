"""
Required-word matching: is a typed word an inflection of the required word?

The frontend pre-filters on spelling (edit distance), then asks the backend to
decide whether a syntactically-similar pair is *the same word* — "planes" should
satisfy "plane", but "planet" should not. This is a lemma question, not a
semantic-similarity one: sentence/word embeddings conflate "same lemma" with
"looks/means alike", so they happily match "pala"/"palos". Two dictionary
lemmatizers instead reduce each word to its base form and compare.

Why two? They are complementary (QA'd on ~180 ES/EN pairs at perfect precision —
no distinct-noun look-alike ever matches):

- simplemma catches animate-noun gender (gato→gato, so gato/gata match) but
  leaves adjective gender alone (alta stays "alta").
- spaCy tags "alta" as an adjective and lemmatises it to "alto", so alto/alta
  match — but it treats gata as its own noun lemma.

Neither ever collapses genuinely different nouns (palo/pala, puerto/puerta), so
their union recovers both gender kinds while keeping look-alikes apart. A
regular-plural rule fills the remaining gaps (flor/flores, luz/luces), applied to
the surface words and to the simplemma lemmas.

The residual misses are a couple of verb person forms (hablo/hablas), acceptable
because recovering them would require matching genuine look-alikes.

Kept free of HTTP/DB/auth coupling like :mod:`app.word_engine`; imported by the
``/words/match`` route and the ``match_word`` CLI.
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING

import simplemma

from app.word_engine import Language

if TYPE_CHECKING:
    from spacy.language import Language as SpacyPipeline

# spaCy model per language (md tier: perfect precision on the QA set; sm
# false-matched banco/banca and foco/foca). Installed as pinned deps, so no
# runtime download — see pyproject `[tool.uv.sources]`.
_SPACY_MODELS: dict[Language, str] = {
    Language.ES: "es_core_news_md",
    Language.EN: "en_core_web_md",
}

# Two distinct locks: one guards lazy loading of the pipelines, the other
# serialises pipeline calls (spaCy pipelines are not guaranteed thread-safe).
# They must never be nested — doing so self-deadlocks a non-reentrant Lock.
_spacy_load_lock = threading.Lock()
_spacy_call_lock = threading.Lock()
_spacy_cache: dict[Language, SpacyPipeline] = {}


def _load_spacy(language: Language) -> SpacyPipeline:
    """Load (and memoise) the spaCy pipeline for ``language`` (tagger + lemmatizer)."""
    cached = _spacy_cache.get(language)
    if cached is not None:
        return cached
    with _spacy_load_lock:
        cached = _spacy_cache.get(language)
        if cached is None:
            import spacy

            # Only the tagger/morphologizer + lemmatizer are needed.
            cached = spacy.load(_SPACY_MODELS[language], disable=["parser", "ner"])
            _spacy_cache[language] = cached
    return cached


def preload(languages: tuple[Language, ...]) -> None:
    """Warm the spaCy pipelines at startup so the first match isn't slow."""
    for language in languages:
        _load_spacy(language)


def _spacy_lemma(word: str, language: Language) -> str:
    """The spaCy lemma of ``word`` (lowercased); the input itself on any failure."""
    # Resolve (and possibly load) the pipeline *before* taking the call lock, so
    # the load lock and the call lock are never held at the same time.
    pipeline = _load_spacy(language)
    try:
        with _spacy_call_lock:
            doc = pipeline(word)
    except Exception:  # noqa: BLE001 — a lemmatiser miss must not 500 the endpoint.
        return word
    return doc[0].lemma_.casefold() if len(doc) else word


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
    *either* lemmatiser (simplemma for noun gender, spaCy for adjective gender),
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
    if _spacy_lemma(a, language) == _spacy_lemma(b, language):
        return True
    return _is_regular_plural(a, b, language) or _is_regular_plural(sa, sb, language)
