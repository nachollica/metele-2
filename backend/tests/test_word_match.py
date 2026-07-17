"""Tests for the lemma-based required-word matcher (``app.word_match``)."""

from __future__ import annotations

import pytest

from app.word_engine import Language
from app.word_match import is_match, lemma

ES = Language.ES
EN = Language.EN

# Inflections of the same word — must match. Includes gender pairs: adjective
# gender (alto/alta, via spaCy) and animate-noun gender (gato/gata, via simplemma).
VARIANTS = [
    ("plan", "planes", ES),
    ("palo", "palos", ES),
    ("pala", "palas", ES),
    ("gato", "gatos", ES),
    ("flor", "flores", ES),
    ("luz", "luces", ES),
    ("perro", "perra", ES),
    ("ciudad", "ciudades", ES),
    ("alto", "alta", ES),  # adjective gender
    ("rojo", "roja", ES),
    ("nuevo", "nueva", ES),
    ("gato", "gata", ES),  # animate-noun gender
    ("niño", "niña", ES),
    ("hijo", "hija", ES),
    ("plane", "planes", EN),
    ("cat", "cats", EN),
    ("city", "cities", EN),
    ("leaf", "leaves", EN),
    ("knife", "knives", EN),
    ("run", "runs", EN),
]

# Spelled similarly, different words — must NOT match. Includes the reported
# cases (pala/palo, palos/palas) and distinct o/a noun pairs that look like
# gender inflections but are different words (puerto/puerta, banco/banca).
LOOKALIKES = [
    ("pala", "palo", ES),
    ("palos", "palas", ES),
    ("pala", "palos", ES),
    ("plan", "plano", ES),
    ("gato", "pato", ES),
    ("casa", "caza", ES),
    ("pero", "perro", ES),
    ("sal", "sol", ES),
    ("puerto", "puerta", ES),  # port / door
    ("caso", "casa", ES),  # case / house
    ("banco", "banca", ES),
    ("foco", "foca", ES),  # focus / seal
    ("modo", "moda", ES),
    ("plane", "planet", EN),
    ("cat", "car", EN),
    ("angel", "angle", EN),
    ("dessert", "desert", EN),
    ("star", "scar", EN),
    ("host", "hose", EN),
]


class TestIsMatch:
    @pytest.mark.parametrize(("a", "b", "lang"), VARIANTS)
    def test_variants_match(self, a: str, b: str, lang: Language) -> None:
        assert is_match(a, b, lang), f"{a!r}/{b!r} should match in {lang.value}"

    @pytest.mark.parametrize(("a", "b", "lang"), LOOKALIKES)
    def test_lookalikes_do_not_match(self, a: str, b: str, lang: Language) -> None:
        assert not is_match(a, b, lang), f"{a!r}/{b!r} should NOT match in {lang.value}"

    def test_is_symmetric(self) -> None:
        assert is_match("planes", "plan", ES) == is_match("plan", "planes", ES)
        assert is_match("palos", "pala", ES) == is_match("pala", "palos", ES)

    def test_identical_and_case_insensitive(self) -> None:
        assert is_match("Plane", "plane", EN)
        assert is_match("GATO", "gato", ES)

    def test_blank_never_matches(self) -> None:
        assert not is_match("", "plane", EN)
        assert not is_match("plane", "   ", EN)

    def test_language_is_respected(self) -> None:
        # "luces" → "luz" only under the Spanish lemmatizer/plural rules.
        assert is_match("luz", "luces", ES)


class TestLemma:
    def test_reduces_plurals(self) -> None:
        assert lemma("gatos", ES) == "gato"
        assert lemma("cats", EN) == "cat"

    def test_unknown_word_returns_itself(self) -> None:
        assert lemma("zzqqx", EN) == "zzqqx"

    def test_blank_returns_empty(self) -> None:
        assert lemma("   ", ES) == ""
