"""Tests for ``POST /words/related`` and the language resolution helpers."""

from __future__ import annotations

import pytest

from app.routes.words import (
    Language,
    expand_related,
    parse_accept_language,
)


# ---- parse_accept_language ---------------------------------------------


class TestParseAcceptLanguage:
    def test_returns_none_for_missing_or_blank(self) -> None:
        assert parse_accept_language(None) is None
        assert parse_accept_language("") is None
        assert parse_accept_language("   ") is None

    def test_picks_first_supported_tag(self) -> None:
        assert parse_accept_language("en-US,en;q=0.9") is Language.EN
        assert parse_accept_language("es-AR,es;q=0.9,en;q=0.5") is Language.ES

    def test_obeys_q_weights_over_header_order(self) -> None:
        # `fr` is unsupported, so the highest-weight *supported* tag should win
        # even though it appears later in the header.
        assert parse_accept_language("fr;q=1.0,en;q=0.4,es;q=0.8") is Language.ES

    def test_skips_zero_weight_tags(self) -> None:
        # ``en;q=0`` means "explicitly not acceptable" → fall through to es.
        assert parse_accept_language("en;q=0,es;q=0.5") is Language.ES

    def test_returns_none_when_no_supported_tag(self) -> None:
        assert parse_accept_language("fr,de;q=0.8,it;q=0.5") is None

    def test_ignores_garbage_tokens(self) -> None:
        assert parse_accept_language("***,en") is Language.EN

    def test_invalid_q_value_treated_as_not_acceptable(self) -> None:
        # Non-numeric q falls back to 0 so the tag is dropped, not used at 1.0.
        assert parse_accept_language("en;q=abc,es") is Language.ES


# ---- expand_related ----------------------------------------------------


class TestExpandRelated:
    def test_english_animal_returns_known_hyponyms(self) -> None:
        result = expand_related(["animal"], Language.EN, depth=2, limit=200)
        assert result, "expected non-empty expansion for English 'animal'"
        # Sample of stable WordNet hyponyms — the exact list shifts with NLTK
        # versions, so just assert that some recognisable members are present.
        lower = {w.lower() for w in result}
        assert lower & {"adult", "biped", "captive", "chordate"}

    def test_spanish_animal_returns_spanish_lemmas(self) -> None:
        result = expand_related(["animal"], Language.ES, depth=2, limit=200)
        assert result
        # Spanish OMW data is sparser, but a couple of common nouns always
        # come back. We pick low-controversy ones.
        lower = {w.lower() for w in result}
        assert lower & {"adulto", "carnívoro", "caballo"}

    def test_excludes_input_words_case_insensitively(self) -> None:
        result = expand_related(["Animal"], Language.EN, depth=2, limit=200)
        assert "animal" not in {w.lower() for w in result}

    def test_underscore_lemmas_get_normalised_to_spaces(self) -> None:
        # WordNet stores multi-word lemmas with underscores; we strip them so
        # the frontend can show them verbatim.
        result = expand_related(["animal"], Language.EN, depth=2, limit=500)
        assert not any("_" in w for w in result)

    def test_multi_token_and_hyphenated_lemmas_filtered_out(self) -> None:
        # Frontend can only check the last finished word, so phrases with
        # whitespace or punctuation are unreachable as required words and
        # must not appear in the response.
        result = expand_related(["animal"], Language.EN, depth=3, limit=500)
        assert result, "expected non-empty expansion to actually exercise filter"
        for word in result:
            assert " " not in word, f"multi-word lemma slipped through: {word!r}"
            assert "-" not in word, f"hyphenated lemma slipped through: {word!r}"
            assert "'" not in word, f"apostrophed lemma slipped through: {word!r}"

    def test_result_is_sorted_and_deduped(self) -> None:
        # Asking the same input twice shouldn't double the output.
        once = expand_related(["dog"], Language.EN, depth=1, limit=500)
        twice = expand_related(["dog", "dog"], Language.EN, depth=1, limit=500)
        assert once == twice
        # Sorted (case-insensitive).
        assert once == sorted(once, key=str.casefold)

    def test_limit_truncates_output(self) -> None:
        capped = expand_related(["animal"], Language.EN, depth=3, limit=5)
        assert len(capped) == 5

    def test_unknown_word_yields_empty(self) -> None:
        # ``zzzzzzz`` isn't in any synset → expansion is empty (no error).
        assert expand_related(["zzzzzzz"], Language.EN, depth=2, limit=10) == []

    def test_blank_inputs_are_ignored(self) -> None:
        # Pydantic enforces non-empty list; the route still accepts items that
        # collapse to empty strings — they should be silently dropped.
        result = expand_related(["  ", "animal"], Language.EN, depth=1, limit=20)
        assert result, "non-empty input should still produce expansion"


# ---- POST /words/related (route-level) ---------------------------------


class TestRelatedWordsRoute:
    URL = "/words/related"

    def test_explicit_language_wins_over_header(self, client) -> None:
        r = client.post(
            self.URL,
            json={"words": ["animal"], "language": "es", "depth": 1, "limit": 5},
            headers={"Accept-Language": "en"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["language"] == "es"
        assert body["words"], "expansion should be non-empty"

    def test_header_language_used_when_body_missing(self, client) -> None:
        r = client.post(
            self.URL,
            json={"words": ["dog"], "depth": 1, "limit": 5},
            headers={"Accept-Language": "es-AR,es;q=0.9,en;q=0.5"},
        )
        assert r.status_code == 200
        assert r.json()["language"] == "es"

    def test_missing_language_returns_400(self, client) -> None:
        r = client.post(self.URL, json={"words": ["dog"]})
        assert r.status_code == 400
        assert "language" in r.json()["detail"].lower()

    def test_unsupported_header_language_returns_400(self, client) -> None:
        r = client.post(
            self.URL,
            json={"words": ["dog"]},
            headers={"Accept-Language": "fr,de;q=0.8"},
        )
        assert r.status_code == 400

    def test_empty_words_list_is_rejected(self, client) -> None:
        r = client.post(self.URL, json={"words": [], "language": "en"})
        assert r.status_code == 422

    @pytest.mark.parametrize("field,value", [("depth", 0), ("depth", 99), ("limit", 0)])
    def test_validation_bounds(self, client, field: str, value: int) -> None:
        body: dict[str, object] = {"words": ["dog"], "language": "en"}
        body[field] = value
        r = client.post(self.URL, json=body)
        assert r.status_code == 422

    def test_response_shape_matches_schema(self, client) -> None:
        r = client.post(
            self.URL,
            json={"words": ["fruit"], "language": "en", "depth": 2, "limit": 8},
        )
        assert r.status_code == 200
        body = r.json()
        assert set(body.keys()) == {"language", "words"}
        assert body["language"] == "en"
        assert isinstance(body["words"], list)
        assert all(isinstance(w, str) for w in body["words"])
