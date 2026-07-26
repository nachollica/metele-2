"""
Precompute the per-language "match map" consumed by the frontend matcher.

Run (needs the build dependency group)::

    uv run python -m app.scripts.build_match_map
    uv run python -m app.scripts.build_match_map -l es

For each language it emits ``frontend/public/match-map/{lang}.vN.json``: a
mapping of normalised surface form to an integer group id, where two words share
a group id iff they are the same word inflected. The frontend loads this once
and decides required-word matches entirely client-side (no per-keystroke backend
call); see ``frontend/lib/flowfic/match-map.ts``.

Groups are the connected components of two edge sets over the pool's inflections:
simplemma's dictionary lemma (noun gender, plurals) and spaCy's lemma (adjective
gender, e.g. alta→alto). Only inflections of a pool word are included — those are
the only forms that can ever match a required word — and singletons are omitted
(absence from the map means "matches only itself"). The regular-plural backstop
(leaf/leaves) is applied in the frontend, mirroring the old backend matcher.

This is the single build-time source of truth for matching, generated from the
same ``data/word_pool`` the backend samples required words from.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import unicodedata

from app.word_engine import LANGUAGES, Language, _pool_path, default_data_dir

# Bump alongside the frontend's MATCH_MAP_VERSION when the format/inputs change.
MATCH_MAP_VERSION = 1

# spaCy model per language (md tier: perfect precision on the QA set).
_SPACY_MODELS: dict[Language, str] = {
    Language.ES: "es_core_news_md",
    Language.EN: "en_core_web_md",
}

# ---- Normalisation -----------------------------------------------------
# MUST mirror ``normalizeForMatch`` in frontend/lib/flowfic/words.ts so the map
# keys line up with what the frontend looks up. Keep the two in sync.

_SPECIAL_LETTER_MAP = {
    "ł": "l", "ø": "o", "đ": "d", "ð": "d", "þ": "th", "ß": "ss",
    "æ": "ae", "œ": "oe", "ı": "i", "ħ": "h", "ŧ": "t", "ƀ": "b",
}  # fmt: skip
_SPECIAL_LETTER_RE = re.compile("[" + "".join(_SPECIAL_LETTER_MAP) + "]")
_COMBINING_RE = re.compile(r"[̀-ͯ]")


def normalize_for_match(text: str) -> str:
    """Lowercase, fold special letters, and strip diacritics (see words.ts)."""
    lowered = text.lower()
    replaced = _SPECIAL_LETTER_RE.sub(lambda m: _SPECIAL_LETTER_MAP[m.group()], lowered)
    decomposed = unicodedata.normalize("NFD", replaced)
    return _COMBINING_RE.sub("", decomposed)


# ---- Connected components (pure, unit-tested) --------------------------


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
    ``spacy_lemma_of`` adds a spaCy-lemma edge (adjective gender). Every surface
    and lemma is normalised first, so keys match the frontend. Singletons (a form
    connected to nothing else) are omitted — the frontend treats a missing key as
    matching only itself.
    """
    uf = _UnionFind()
    nodes: set[str] = set()
    for surface, lemma in lemma_of.items():
        a, b = normalize_for_match(surface), normalize_for_match(lemma)
        uf.union(a, b)
        nodes.add(a)
        nodes.add(b)
    for surface, lemma in spacy_lemma_of.items():
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


# ---- Build (build-time only) ------------------------------------------


def _default_out_dir() -> str:
    """``<repo>/frontend/public/match-map``, relative to this script."""
    repo_root = os.path.dirname(  # flowfic/
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
    return os.path.join(repo_root, "frontend", "public", "match-map")


def _pool_words(language: Language) -> list[str]:
    import numpy as np

    data = np.load(_pool_path(default_data_dir(), language), allow_pickle=True)
    return [str(w) for w in data["words"]]


def _build_language(language: Language) -> dict[str, int]:
    """Assemble the simplemma + spaCy edges for ``language`` and group them."""
    import spacy
    from simplemma.strategies.dictionaries.dictionary_factory import DefaultDictionaryFactory

    pool = _pool_words(language)

    # Full surface→lemma dictionary, restricted to inflections of pool words.
    factory = DefaultDictionaryFactory()
    raw = factory.get_dictionary(language.value)
    dictionary = {
        (k.decode() if isinstance(k, bytes) else k): (v.decode() if isinstance(v, bytes) else v)
        for k, v in raw.items()
    }
    pool_lemmas = {dictionary.get(w, w) for w in pool}
    lemma_of = {s: lemma for s, lemma in dictionary.items() if lemma in pool_lemmas}
    for word in pool:  # ensure pool words themselves are nodes
        lemma_of.setdefault(word, dictionary.get(word, word))

    # spaCy lemma edges over the pool (adjective gender: alta→alto).
    nlp = spacy.load(_SPACY_MODELS[language], disable=["parser", "ner"])
    spacy_lemma_of: dict[str, str] = {}
    for word, doc in zip(pool, nlp.pipe(pool), strict=True):
        if not len(doc):
            continue
        lemma = doc[0].lemma_.casefold()
        if lemma and lemma != word.casefold() and lemma.isalpha():
            spacy_lemma_of[word] = lemma

    return build_groups(lemma_of, spacy_lemma_of)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="build_match_map",
        description="Precompute the per-language match map for the frontend matcher.",
    )
    parser.add_argument(
        "-l",
        "--language",
        choices=[lang.value for lang in Language],
        action="append",
        help="Language(s) to build (repeatable). Defaults to all supported languages.",
    )
    parser.add_argument(
        "--out-dir",
        default=None,
        help="Output directory (default: <repo>/frontend/public/match-map).",
    )
    args = parser.parse_args()

    out_dir = args.out_dir or _default_out_dir()
    os.makedirs(out_dir, exist_ok=True)
    languages = [Language(code) for code in args.language] if args.language else list(LANGUAGES)
    for language in languages:
        groups = _build_language(language)
        path = os.path.join(out_dir, f"{language.value}.v{MATCH_MAP_VERSION}.json")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(groups, handle, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        distinct = len(set(groups.values()))
        print(f"{language.value}: {len(groups)} forms in {distinct} groups -> {path}")


if __name__ == "__main__":
    main()
