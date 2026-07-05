"""Tests for ``POST /words/related`` and the language resolution helpers."""

from __future__ import annotations

import pytest

from app.wordnet import (
    Language,
    expand_related,
    is_common,
    is_morphological_variant,
    parse_accept_language,
    random_words,
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
    # A limit larger than any expansion so the full (unsampled) set comes back,
    # keeping membership assertions order- and sampling-independent.
    FULL = 5000

    def test_english_animal_returns_known_hyponyms(self) -> None:
        result = expand_related(["animal"], Language.EN, depth=2, limit=self.FULL)
        assert result, "expected non-empty expansion for English 'animal'"
        # Sample of stable, common WordNet hyponyms — the exact list shifts with
        # NLTK versions, so just assert that some recognisable members survive
        # (obscure ones like "biped"/"chordate" are dropped by the frequency
        # filter, so we assert on common ones).
        lower = {w.lower() for w in result}
        assert lower & {"adult", "captive"}

    def test_spanish_animal_returns_spanish_lemmas(self) -> None:
        result = expand_related(["animal"], Language.ES, depth=2, limit=self.FULL)
        assert result
        # Spanish OMW data is sparser, but a couple of common nouns always
        # come back. We pick low-controversy ones.
        lower = {w.lower() for w in result}
        assert lower & {"adulto", "carnívoro", "caballo"}

    def test_excludes_input_words_case_insensitively(self) -> None:
        result = expand_related(["Animal"], Language.EN, depth=2, limit=self.FULL)
        assert "animal" not in {w.lower() for w in result}

    def test_underscore_lemmas_get_normalised_to_spaces(self) -> None:
        # WordNet stores multi-word lemmas with underscores; we strip them so
        # the frontend can show them verbatim.
        result = expand_related(["animal"], Language.EN, depth=2, limit=self.FULL)
        assert not any("_" in w for w in result)

    def test_multi_token_and_hyphenated_lemmas_filtered_out(self) -> None:
        # Frontend can only check the last finished word, so phrases with
        # whitespace or punctuation are unreachable as required words and
        # must not appear in the response.
        result = expand_related(["animal"], Language.EN, depth=3, limit=self.FULL)
        assert result, "expected non-empty expansion to actually exercise filter"
        for word in result:
            assert " " not in word, f"multi-word lemma slipped through: {word!r}"
            assert "-" not in word, f"hyphenated lemma slipped through: {word!r}"
            assert "'" not in word, f"apostrophed lemma slipped through: {word!r}"

    def test_no_duplicates(self) -> None:
        # Asking the same input twice (and a single time) must not duplicate.
        result = expand_related(["dog", "dog"], Language.EN, depth=1, limit=self.FULL)
        folded = [w.casefold() for w in result]
        assert len(folded) == len(set(folded))

    def test_limit_caps_output(self) -> None:
        capped = expand_related(["animal"], Language.EN, depth=3, limit=5)
        assert len(capped) == 5

    def test_unknown_word_yields_empty(self) -> None:
        # ``zzzzzzz`` isn't in any synset → expansion is empty (no error).
        assert expand_related(["zzzzzzz"], Language.EN, depth=2, limit=10) == []

    def test_blank_inputs_are_ignored(self) -> None:
        # Pydantic enforces non-empty list; the route still accepts items that
        # collapse to empty strings — they should be silently dropped.
        result = expand_related(["  ", "animal"], Language.EN, depth=1, limit=self.FULL)
        assert result, "non-empty input should still produce expansion"

    def test_deeper_walk_yields_more_than_shallow(self) -> None:
        # The BFS over hyponyms + related edges should grow the pool as we
        # crank ``depth``. Asserts the new walker isn't accidentally bounded
        # by the *seed's* hyponyms alone.
        shallow = expand_related(["fruit"], Language.EN, depth=1, limit=self.FULL)
        deep = expand_related(["fruit"], Language.EN, depth=4, limit=self.FULL)
        assert len(deep) > len(shallow)

    def test_only_common_words_returned(self) -> None:
        # Every word must clear the commonness threshold — no scientific noise.
        result = expand_related(["animal"], Language.ES, depth=3, limit=self.FULL)
        assert result
        assert all(is_common(w, Language.ES) for w in result)
        # A genus name that WordNet lists under "animal" must be filtered out.
        assert "acaridae" not in {w.lower() for w in result}


# ---- random_words ------------------------------------------------------


class TestRandomWords:
    def test_english_returns_non_empty(self) -> None:
        result = random_words(Language.EN, limit=50)
        assert result, "expected a non-empty random pool for English"

    def test_spanish_returns_non_empty(self) -> None:
        result = random_words(Language.ES, limit=50)
        assert result, "expected a non-empty random pool for Spanish"

    def test_respects_limit(self) -> None:
        result = random_words(Language.EN, limit=10)
        assert len(result) <= 10

    def test_entries_are_single_token(self) -> None:
        result = random_words(Language.EN, limit=200)
        assert result
        for word in result:
            assert " " not in word, f"multi-word lemma slipped through: {word!r}"
            assert "-" not in word, f"hyphenated lemma slipped through: {word!r}"
            assert "'" not in word, f"apostrophed lemma slipped through: {word!r}"

    def test_no_duplicates(self) -> None:
        result = random_words(Language.EN, limit=200)
        folded = [w.casefold() for w in result]
        assert len(folded) == len(set(folded))

    def test_entries_resolve_to_allowed_pos(self) -> None:
        # Every returned word must have a noun/adjective/verb synset — no
        # adverbs or POS-less artefacts.
        from nltk.corpus import wordnet as wn

        result = random_words(Language.EN, limit=100)
        assert result
        allowed = {"n", "a", "s", "v"}
        for word in result:
            synsets = wn.synsets(word, lang="eng")
            assert any(s.pos() in allowed for s in synsets), f"{word!r} has no allowed-POS synset"

    def test_entries_are_lowercase_alpha(self) -> None:
        # No digits, punctuation, or proper-noun capitalisation.
        result = random_words(Language.EN, limit=200)
        assert result
        for word in result:
            assert word.isalpha(), f"non-alphabetic word: {word!r}"
            assert word == word.lower(), f"capitalised word: {word!r}"

    def test_only_common_words_returned(self) -> None:
        for lang in (Language.EN, Language.ES):
            result = random_words(lang, limit=150)
            assert result
            assert all(is_common(w, lang) for w in result), f"uncommon word in {lang.value} pool"


# ---- is_morphological_variant -----------------------------------------


class TestIsMorphologicalVariant:
    def test_identity(self) -> None:
        assert is_morphological_variant("love", "love")

    def test_plural_of_noun(self) -> None:
        assert is_morphological_variant("lovers", "lover")
        assert is_morphological_variant("dogs", "dog")

    def test_verb_inflections(self) -> None:
        # English: gerund + past tense of "love" should both resolve back.
        assert is_morphological_variant("loving", "love")
        assert is_morphological_variant("loved", "love")

    def test_rejects_synonyms_not_variants(self) -> None:
        # "romance" / "passion" share senses with "love" but are NOT
        # morphological variants — the helper must reject them.
        assert not is_morphological_variant("romance", "love")
        assert not is_morphological_variant("passion", "love")

    def test_rejects_unrelated_words(self) -> None:
        assert not is_morphological_variant("dog", "love")

    def test_blank_inputs_return_false(self) -> None:
        assert not is_morphological_variant("", "love")
        assert not is_morphological_variant("love", "")


# ---- POST /words/related (route-level) ---------------------------------


class TestRelatedWordsRoute:
    URL = "/words/related"

    def test_requires_auth(self, client) -> None:
        r = client.post(
            self.URL,
            json={"words": ["animal"], "language": "en"},
        )
        assert r.status_code == 401

    def test_explicit_language_wins_over_header(self, auth_client) -> None:
        r = auth_client.post(
            self.URL,
            json={"words": ["animal"], "language": "es", "depth": 1, "limit": 5},
            headers={"Accept-Language": "en"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["language"] == "es"
        assert body["words"], "expansion should be non-empty"

    def test_header_language_used_when_body_missing(self, auth_client) -> None:
        r = auth_client.post(
            self.URL,
            json={"words": ["dog"], "depth": 1, "limit": 5},
            headers={"Accept-Language": "es-AR,es;q=0.9,en;q=0.5"},
        )
        assert r.status_code == 200
        assert r.json()["language"] == "es"

    def test_missing_language_returns_400(self, auth_client) -> None:
        r = auth_client.post(self.URL, json={"words": ["dog"]})
        assert r.status_code == 400
        assert "language" in r.json()["detail"].lower()

    def test_unsupported_header_language_returns_400(self, auth_client) -> None:
        r = auth_client.post(
            self.URL,
            json={"words": ["dog"]},
            headers={"Accept-Language": "fr,de;q=0.8"},
        )
        assert r.status_code == 400

    def test_empty_words_list_is_rejected(self, auth_client) -> None:
        r = auth_client.post(self.URL, json={"words": [], "language": "en"})
        assert r.status_code == 422

    @pytest.mark.parametrize(("field", "value"), [("depth", 0), ("depth", 99), ("limit", 0)])
    def test_validation_bounds(self, auth_client, field: str, value: int) -> None:
        body: dict[str, object] = {"words": ["dog"], "language": "en"}
        body[field] = value
        r = auth_client.post(self.URL, json=body)
        assert r.status_code == 422

    def test_response_shape_matches_schema(self, auth_client) -> None:
        r = auth_client.post(
            self.URL,
            json={"words": ["fruit"], "language": "en", "depth": 2, "limit": 8},
        )
        assert r.status_code == 200
        body = r.json()
        assert set(body.keys()) == {"language", "words"}
        assert body["language"] == "en"
        assert isinstance(body["words"], list)
        assert all(isinstance(w, str) for w in body["words"])


# ---- POST /words/random (route-level) ----------------------------------


class TestRandomWordsRoute:
    URL = "/words/random"

    def test_requires_auth(self, client) -> None:
        r = client.post(self.URL, json={"language": "en"})
        assert r.status_code == 401

    def test_explicit_language_wins_over_header(self, auth_client) -> None:
        r = auth_client.post(
            self.URL,
            json={"language": "es", "limit": 20},
            headers={"Accept-Language": "en"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["language"] == "es"
        assert body["words"], "random pool should be non-empty"

    def test_header_language_used_when_body_missing(self, auth_client) -> None:
        r = auth_client.post(
            self.URL,
            json={"limit": 20},
            headers={"Accept-Language": "es-AR,es;q=0.9,en;q=0.5"},
        )
        assert r.status_code == 200
        assert r.json()["language"] == "es"

    def test_missing_language_returns_400(self, auth_client) -> None:
        r = auth_client.post(self.URL, json={})
        assert r.status_code == 400
        assert "language" in r.json()["detail"].lower()

    @pytest.mark.parametrize("value", [0, 9999])
    def test_limit_bounds(self, auth_client, value: int) -> None:
        r = auth_client.post(self.URL, json={"language": "en", "limit": value})
        assert r.status_code == 422

    def test_response_shape_matches_schema(self, auth_client) -> None:
        r = auth_client.post(self.URL, json={"language": "en", "limit": 8})
        assert r.status_code == 200
        body = r.json()
        assert set(body.keys()) == {"language", "words"}
        assert body["language"] == "en"
        assert len(body["words"]) <= 8
        assert all(isinstance(w, str) for w in body["words"])
