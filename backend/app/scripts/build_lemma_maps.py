"""
Precompute the per-language spaCy lemma maps for the required-word matcher.

Run::

    uv run python -m app.scripts.build_lemma_maps
    uv run python -m app.scripts.build_lemma_maps -l es

For each language it lemmatises the clean candidate pool with spaCy (the md
models) and writes ``data/lemma_maps/{lang}.vN.json`` mapping each surface form
to its spaCy lemma — but only where they differ, to keep the file small. At
runtime :mod:`app.word_match` does a dict lookup instead of loading spaCy,
replaying spaCy's decision for every pooled word (see that module for why this
preserves precision). spaCy therefore ships only in the build dependency group,
never in the runtime image.
"""

from __future__ import annotations

import argparse
import json
import os

import spacy

from app.word_engine import LANGUAGES, Language, _clean_candidates, default_data_dir
from app.word_match import _LEMMA_MAP_VERSION, _map_path

# spaCy model per language (md tier: perfect precision on the QA set; sm
# false-matched banco/banca and foco/foca). Installed as build-group deps.
_SPACY_MODELS: dict[Language, str] = {
    Language.ES: "es_core_news_md",
    Language.EN: "en_core_web_md",
}


def _build_map(language: Language, vocab_size: int) -> dict[str, str]:
    """Surface (casefolded) → spaCy lemma, for pool words whose lemma differs."""
    # Only the tagger/morphologizer + lemmatizer are needed.
    nlp = spacy.load(_SPACY_MODELS[language], disable=["parser", "ner"])
    words = list(_clean_candidates(language, vocab_size))

    mapping: dict[str, str] = {}
    for word, doc in zip(words, nlp.pipe(words), strict=True):
        if not len(doc):
            continue
        folded = word.casefold()
        lemma = doc[0].lemma_.casefold()
        if lemma and lemma != folded and lemma.isalpha():
            mapping[folded] = lemma
    return mapping


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="build_lemma_maps",
        description="Precompute the spaCy lemma maps used by the required-word matcher.",
    )
    parser.add_argument(
        "-l",
        "--language",
        choices=[lang.value for lang in Language],
        action="append",
        help="Language(s) to build (repeatable). Defaults to all supported languages.",
    )
    parser.add_argument(
        "--vocab-size",
        type=int,
        default=int(os.environ.get("WORD_POOL_VOCAB_SIZE", "60000")),
        help="How many of a language's most frequent words to lemmatise.",
    )
    args = parser.parse_args()

    data_dir = os.environ.get("WORD_DATA_DIR") or default_data_dir()
    languages = [Language(code) for code in args.language] if args.language else list(LANGUAGES)
    for language in languages:
        mapping = _build_map(language, args.vocab_size)
        path = _map_path(data_dir, language)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(mapping, handle, ensure_ascii=False, sort_keys=True)
        print(f"{language.value}: {len(mapping)} lemma entries -> {path} (v{_LEMMA_MAP_VERSION}).")


if __name__ == "__main__":
    main()
