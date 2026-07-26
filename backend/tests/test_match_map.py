"""
Tests for the pure match-map builder (``app.scripts.build_match_map``).

Only the pure normalisation + connected-components logic is exercised here; the
full build (simplemma dictionary + spaCy) is a build-time script and is not run
in the suite. ``build_groups`` takes the two edge sets directly, so we can feed
synthetic ones and assert the resulting grouping.
"""

from __future__ import annotations

from app.scripts.build_match_map import build_groups, normalize_for_match


class TestNormalizeForMatch:
    def test_lowercases_and_strips_diacritics(self) -> None:
        assert normalize_for_match("Brújula") == "brujula"
        assert normalize_for_match("¡Mármol!") == "¡marmol!"  # punctuation left to the caller
        assert normalize_for_match("NIÑO") == "nino"

    def test_folds_special_letters(self) -> None:
        assert normalize_for_match("Straße") == "strasse"
        assert normalize_for_match("œuvre") == "oeuvre"


class TestBuildGroups:
    # simplemma-style surface → lemma, plus a spaCy adjective-gender edge.
    LEMMA_OF = {
        "gato": "gato", "gata": "gato", "gatos": "gato", "gatas": "gato",
        "alto": "alto", "altos": "alto", "alta": "alta", "altas": "alta",
        "palo": "palo", "palos": "palo", "pala": "pala", "palas": "pala",
        "solo": "solo",  # no siblings → singleton
    }  # fmt: skip
    SPACY = {"alta": "alto"}  # adjective gender

    def _groups(self) -> dict[str, int]:
        return build_groups(self.LEMMA_OF, self.SPACY)

    def _match(self, groups: dict[str, int], a: str, b: str) -> bool:
        ga, gb = groups.get(a), groups.get(b)
        return ga is not None and ga == gb

    def test_inflections_and_noun_gender_share_a_group(self) -> None:
        groups = self._groups()
        assert self._match(groups, "gato", "gata")
        assert self._match(groups, "gato", "gatos")

    def test_adjective_gender_merges_via_spacy_edge(self) -> None:
        groups = self._groups()
        assert self._match(groups, "alto", "alta")
        assert self._match(groups, "alto", "altas")  # altas→alta→alto chain

    def test_lookalikes_stay_apart(self) -> None:
        groups = self._groups()
        assert not self._match(groups, "palo", "pala")
        assert not self._match(groups, "gato", "palo")

    def test_singletons_are_omitted(self) -> None:
        assert "solo" not in self._groups()

    def test_normalises_keys(self) -> None:
        # Accented surfaces are stored under their normalised key.
        groups = build_groups({"canción": "canción", "canciones": "canción"}, {})
        assert groups.get("cancion") == groups.get("canciones")
        assert "canción" not in groups  # only the normalised form is a key
