"""
Build the per-language match map (``frontend/public/match-map/{lang}.vN.json``).

The map is normalised surface form → integer group id, where two words share a
group id iff they are the same word inflected. Groups are the connected
components of two edge sets over the pool's inflections: simplemma's dictionary
lemma (noun gender, plurals) and spaCy's lemma (adjective gender, alta→alto).
Only inflections of a pool word are included, and singletons are omitted (a
missing key means "matches only itself"). The frontend loads this and matches
locally, with a small regular-plural rule for the rest.
"""

from __future__ import annotations

import json
import os

import numpy as np

from contract import LANGUAGES, NPZ_WORDS, match_map_path, normalize_for_match, pool_path

# spaCy model per language (md tier: perfect precision on the QA set).
_SPACY_MODELS: dict[str, str] = {
    "es": "es_core_news_md",
    "en": "en_core_web_md",
}


class _UnionFind:
    """Minimal union-find over strings with path halving."""

    def __init__(self) -> None:
        self._parent: dict[str, str] = {}

    def find(self, node: str) -> str:
        parent = self._parent
        parent.setdefault(node, node)
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self._parent[ra] = rb


def build_groups(
    lemma_of: dict[str, str],
    spacy_lemma_of: dict[str, str],
) -> dict[str, int]:
    """
    Normalised surface → integer group id for the union of the two lemma edges.

    ``lemma_of`` maps each relevant surface to its simplemma lemma; each entry of
    ``spacy_lemma_of`` adds a spaCy-lemma edge. Every surface and lemma is
    normalised first, so keys match the frontend. Singletons are omitted.
    """
    uf = _UnionFind()
    nodes: set[str] = set()
    for surface, lemma in (*lemma_of.items(), *spacy_lemma_of.items()):
        a, b = normalize_for_match(surface), normalize_for_match(lemma)
        uf.union(a, b)
        nodes.add(a)
        nodes.add(b)

    members: dict[str, list[str]] = {}
    for node in nodes:
        members.setdefault(uf.find(node), []).append(node)

    groups: dict[str, int] = {}
    next_id = 0
    for component in members.values():
        if len(component) < 2:
            continue
        for node in component:
            groups[node] = next_id
        next_id += 1
    return groups


def _pool_words(lang: str) -> list[str]:
    """Load the pool words the vector build produced for ``lang``."""
    data = np.load(pool_path(lang), allow_pickle=True)
    return [str(w) for w in data[NPZ_WORDS]]


def build_language(lang: str) -> dict[str, int]:
    """Assemble the simplemma + spaCy edges for ``lang`` and group them."""
    import spacy
    from simplemma.strategies.dictionaries.dictionary_factory import DefaultDictionaryFactory

    pool = _pool_words(lang)

    # Full surface→lemma dictionary, restricted to inflections of pool words.
    factory = DefaultDictionaryFactory()
    raw = factory.get_dictionary(lang)
    dictionary = {
        (k.decode() if isinstance(k, bytes) else k): (v.decode() if isinstance(v, bytes) else v)
        for k, v in raw.items()
    }
    pool_lemmas = {dictionary.get(w, w) for w in pool}
    lemma_of = {s: lemma for s, lemma in dictionary.items() if lemma in pool_lemmas}
    for word in pool:  # ensure pool words themselves are nodes
        lemma_of.setdefault(word, dictionary.get(word, word))

    # spaCy lemma edges over the pool (adjective gender: alta→alto).
    nlp = spacy.load(_SPACY_MODELS[lang], disable=["parser", "ner"])
    spacy_lemma_of: dict[str, str] = {}
    for word, doc in zip(pool, nlp.pipe(pool), strict=True):
        if not len(doc):
            continue
        lemma = doc[0].lemma_.casefold()
        if lemma and lemma != word.casefold() and lemma.isalpha():
            spacy_lemma_of[word] = lemma

    return build_groups(lemma_of, spacy_lemma_of)


def write_match_map(lang: str) -> tuple[int, int]:
    """Build ``lang``'s match map and write it. Returns (forms, distinct groups)."""
    if lang not in LANGUAGES:
        raise ValueError(f"unsupported language {lang!r}")
    groups = build_language(lang)
    path = match_map_path(lang)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(groups, handle, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return len(groups), len(set(groups.values()))
