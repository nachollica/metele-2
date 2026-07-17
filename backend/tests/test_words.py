"""Tests for the words endpoints and the embedding word engine."""

from __future__ import annotations

import numpy as np
import pytest

from app import word_engine as we
from app.word_engine import (
    Language,
    expand_related,
    is_common,
    parse_accept_language,
    random_words,
    semantic_similarity,
)


class _StubModel:
    """A sentence-transformers stand-in: encodes words from a fixed table."""

    def __init__(self, table: dict[str, list[float]], dim: int) -> None:
        self._table = table
        self._dim = dim

    def encode(
        self,
        words: list[str],
        normalize_embeddings: bool = True,
        show_progress_bar: bool = False,
        **_kwargs: object,
    ) -> np.ndarray:
        rows = [self._table.get(w, [0.0] * self._dim) for w in words]
        arr = np.asarray(rows, dtype=np.float32)
        if not normalize_embeddings:
            return arr
        norms = np.maximum(np.linalg.norm(arr, axis=1, keepdims=True), 1e-9)
        return (arr / norms).astype(np.float32)


def _install_stub(
    monkeypatch,
    *,
    table: dict[str, list[float]],
    vocab: list[str] | None = None,
    language: Language = Language.ES,
) -> None:
    """Wire ``_load_model`` (and, if ``vocab`` given, ``_vocab_matrix``) to a stub."""
    dim = len(next(iter(table.values())))
    model = _StubModel(table, dim)
    monkeypatch.setattr(we, "_load_model", lambda: model)
    if vocab is not None:
        matrix = model.encode(vocab)
        monkeypatch.setattr(
            we,
            "_vocab_matrix",
            lambda lang: (vocab, matrix) if lang is language else ([], np.zeros((0, dim))),
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

    def test_supports_the_new_languages(self) -> None:
        assert parse_accept_language("fr-FR") is Language.FR
        assert parse_accept_language("de,en;q=0.5") is Language.DE
        assert parse_accept_language("pt-BR,pt") is Language.PT
        assert parse_accept_language("it") is Language.IT
        assert parse_accept_language("ru-RU") is Language.RU

    def test_obeys_q_weights_over_header_order(self) -> None:
        assert parse_accept_language("zz;q=1.0,en;q=0.4,es;q=0.8") is Language.ES

    def test_skips_zero_weight_tags(self) -> None:
        assert parse_accept_language("en;q=0,es;q=0.5") is Language.ES

    def test_returns_none_when_no_supported_tag(self) -> None:
        assert parse_accept_language("zh,ja;q=0.8,ko;q=0.5") is None

    def test_ignores_garbage_tokens(self) -> None:
        assert parse_accept_language("***,en") is Language.EN

    def test_invalid_q_value_treated_as_not_acceptable(self) -> None:
        assert parse_accept_language("en;q=abc,es") is Language.ES


# ---- cross-language guard ----------------------------------------------


class TestCrossLanguageGuard:
    """The structural guarantee that a language's pool is single-language."""

    def _cross(self, word: str, language: Language) -> bool:
        from wordfreq import zipf_frequency

        return we._is_cross_language(word, language, zipf_frequency(word, language.value))

    def test_english_words_dropped_from_spanish(self) -> None:
        for word in ("food", "kitchen", "eat"):
            assert self._cross(word, Language.ES), f"{word!r} should be flagged for ES"

    def test_spanish_words_kept_for_spanish(self) -> None:
        for word in ("gato", "casa", "comida"):
            assert not self._cross(word, Language.ES), f"{word!r} wrongly flagged for ES"

    def test_cognates_survive(self) -> None:
        for word in ("internet", "hotel"):
            assert not self._cross(word, Language.ES)

    def test_guard_is_symmetric(self) -> None:
        assert self._cross("gato", Language.EN)
        assert not self._cross("cat", Language.EN)

    def test_candidate_vocabulary_is_scrubbed(self) -> None:
        vocab = we._candidate_vocabulary(Language.ES, 3000)
        assert vocab, "expected a non-empty Spanish candidate pool"
        lower = {w.lower() for w in vocab}
        assert not (lower & {"food", "kitchen", "eat", "the", "and"})
        assert all(w.isalpha() and w == w.lower() for w in vocab)


# ---- expand_related ----------------------------------------------------


class TestExpandRelated:
    ES = Language.ES

    # 3-D space: seeds "alpha" (axis 0) and "beta" (axis 1). Alpha's neighbours
    # score very high; beta's score lower but above the 0.3 floor.
    TABLE = {
        "alpha": [1.0, 0.0, 0.0],
        "beta": [0.0, 1.0, 0.0],
        "wolf": [0.99, 0.141, 0.0],  # cos(alpha) ~ 0.99
        "bear": [0.98, 0.199, 0.0],  # cos(alpha) ~ 0.98
        "alphas": [0.995, 0.1, 0.0],  # prefix variant of the seed
        "table": [0.0, 0.7, 0.714],  # cos(beta) ~ 0.70
        "chair": [0.0, 0.6, 0.8],  # cos(beta) ~ 0.60
        "zzz": [0.0, 0.0, 1.0],  # unrelated to both
    }
    VOCAB = ["wolf", "bear", "alphas", "table", "chair", "zzz"]

    def _install(self, monkeypatch) -> None:
        _install_stub(monkeypatch, table=self.TABLE, vocab=self.VOCAB, language=self.ES)

    def test_unions_neighbours_of_all_seeds(self, monkeypatch) -> None:
        self._install(monkeypatch)
        result = set(expand_related(["alpha", "beta"], self.ES, limit=10, min_zipf=0.0))
        assert {"wolf", "bear"} <= result  # alpha's neighbours
        assert {"table", "chair"} <= result  # beta's neighbours
        assert "zzz" not in result  # below the similarity floor for both

    def test_per_seed_quota_keeps_weak_seed_represented(self, monkeypatch) -> None:
        self._install(monkeypatch)
        # limit 2, two seeds → one slot each. Even though beta's best (0.70) loses
        # to alpha's second (0.98) globally, the quota still seats a beta word.
        result = expand_related(["alpha", "beta"], self.ES, limit=2, min_zipf=0.0)
        assert len(result) == 2
        assert set(result) & {"table", "chair"}, "weak seed B must be represented"
        assert set(result) & {"wolf", "bear"}, "strong seed A must be represented"

    def test_excludes_seed_prefix_variants(self, monkeypatch) -> None:
        self._install(monkeypatch)
        result = expand_related(["alpha", "beta"], self.ES, limit=10, min_zipf=0.0)
        assert "alphas" not in result

    def test_respects_limit(self, monkeypatch) -> None:
        self._install(monkeypatch)
        assert len(expand_related(["alpha", "beta"], self.ES, limit=3, min_zipf=0.0)) == 3

    def test_commonness_filter_drops_rare_words(self, monkeypatch) -> None:
        # Real uncommon word in the pool → dropped by the default zipf threshold.
        table = {"animal": [1.0, 0.0], "perro": [0.99, 0.1], "chordate": [0.98, 0.15]}
        _install_stub(monkeypatch, table=table, vocab=["perro", "chordate"], language=self.ES)
        result = expand_related(["animal"], self.ES, limit=10)  # default min_zipf
        assert "chordate" not in result

    def test_degrades_to_empty_when_model_unavailable(self) -> None:
        # The autouse fixture makes ``_load_model`` raise.
        assert expand_related(["animal"], self.ES, limit=5) == []

    def test_blank_and_empty_inputs(self, monkeypatch) -> None:
        self._install(monkeypatch)
        assert expand_related(["   "], self.ES, limit=5, min_zipf=0.0) == []
        assert expand_related(["alpha"], self.ES, limit=0, min_zipf=0.0) == []


# ---- semantic match ----------------------------------------------------


class TestSemanticMatch:
    # "run"/"running" nearly identical; "run"/"rung" far apart.
    TABLE = {
        "run": [1.0, 0.0],
        "running": [0.98, 0.199],  # cos ~ 0.98 → match
        "rung": [0.5, 0.866],  # cos ~ 0.50 → no match
    }

    def test_identical_words_are_a_perfect_match(self) -> None:
        # Short-circuits before the model, so no stub needed.
        assert semantic_similarity("Plane", "plane") == 1.0
        assert we.is_semantic_match("plane", "plane")

    def test_variant_matches(self, monkeypatch) -> None:
        _install_stub(monkeypatch, table=self.TABLE)
        assert semantic_similarity("running", "run") > 0.9
        assert we.is_semantic_match("running", "run")

    def test_lookalike_does_not_match(self, monkeypatch) -> None:
        _install_stub(monkeypatch, table=self.TABLE)
        assert semantic_similarity("rung", "run") < 0.85
        assert not we.is_semantic_match("rung", "run")

    def test_threshold_override(self, monkeypatch) -> None:
        _install_stub(monkeypatch, table=self.TABLE)
        # With a permissive floor even the look-alike passes.
        assert we.is_semantic_match("rung", "run", threshold=0.4)

    def test_blank_inputs_are_not_a_match(self) -> None:
        assert semantic_similarity("", "run") == 0.0
        assert not we.is_semantic_match("run", "")

    def test_degrades_to_zero_when_model_unavailable(self) -> None:
        # Autouse fixture makes the model raise; distinct words → 0.0.
        assert semantic_similarity("running", "run") == 0.0


# ---- random_words ------------------------------------------------------


class TestRandomWords:
    def test_returns_non_empty_for_each_language(self) -> None:
        for lang in (Language.EN, Language.ES, Language.FR, Language.DE):
            assert random_words(lang, limit=20), f"empty random pool for {lang.value}"

    def test_respects_limit(self) -> None:
        assert len(random_words(Language.EN, limit=10)) <= 10

    def test_entries_are_single_token_lowercase_alpha(self) -> None:
        result = random_words(Language.EN, limit=100)
        assert result
        for word in result:
            assert word.isalpha(), f"non-alpha word: {word!r}"
            assert word == word.lower(), f"capitalised word: {word!r}"

    def test_no_duplicates(self) -> None:
        result = random_words(Language.ES, limit=100)
        assert len(result) == len({w.casefold() for w in result})

    def test_only_common_and_single_language(self) -> None:
        result = random_words(Language.ES, limit=100)
        assert result
        assert all(is_common(w, Language.ES) for w in result)
        assert "food" not in {w.lower() for w in result}  # no English leakage


# ---- POST /words/related -----------------------------------------------


class TestRelatedWordsRoute:
    URL = "/words/related"

    def test_requires_auth(self, client) -> None:
        r = client.post(self.URL, json={"words": ["animal"], "language": "en"})
        assert r.status_code == 401

    def test_missing_language_returns_400(self, auth_client) -> None:
        r = auth_client.post(self.URL, json={"words": ["dog"]})
        assert r.status_code == 400
        assert "language" in r.json()["detail"].lower()

    def test_unsupported_header_language_returns_400(self, auth_client) -> None:
        r = auth_client.post(
            self.URL, json={"words": ["dog"]}, headers={"Accept-Language": "zh,ja;q=0.8"}
        )
        assert r.status_code == 400

    def test_empty_words_list_is_rejected(self, auth_client) -> None:
        r = auth_client.post(self.URL, json={"words": [], "language": "en"})
        assert r.status_code == 422

    @pytest.mark.parametrize("value", [0, 9999])
    def test_limit_bounds(self, auth_client, value: int) -> None:
        r = auth_client.post(self.URL, json={"words": ["dog"], "language": "en", "limit": value})
        assert r.status_code == 422

    def test_response_shape_and_stubbed_expansion(self, auth_client, monkeypatch) -> None:
        _install_stub(
            monkeypatch,
            table={"perro": [1.0, 0.0], "gato": [0.98, 0.19], "lejano": [0.0, 1.0]},
            vocab=["gato", "lejano"],
            language=Language.ES,
        )
        r = auth_client.post(self.URL, json={"words": ["perro"], "language": "es", "limit": 8})
        assert r.status_code == 200
        body = r.json()
        assert set(body.keys()) == {"language", "words"}
        assert body["language"] == "es"
        assert "gato" in body["words"]
        assert "lejano" not in body["words"]


# ---- POST /words/random ------------------------------------------------


class TestRandomWordsRoute:
    URL = "/words/random"

    def test_requires_auth(self, client) -> None:
        assert client.post(self.URL, json={"language": "en"}).status_code == 401

    def test_explicit_language_wins_over_header(self, auth_client) -> None:
        r = auth_client.post(
            self.URL, json={"language": "fr", "limit": 20}, headers={"Accept-Language": "en"}
        )
        assert r.status_code == 200
        body = r.json()
        assert body["language"] == "fr"
        assert body["words"]

    def test_missing_language_returns_400(self, auth_client) -> None:
        assert auth_client.post(self.URL, json={}).status_code == 400

    def test_response_shape(self, auth_client) -> None:
        r = auth_client.post(self.URL, json={"language": "en", "limit": 8})
        assert r.status_code == 200
        body = r.json()
        assert set(body.keys()) == {"language", "words"}
        assert len(body["words"]) <= 8


# ---- POST /words/match -------------------------------------------------


class TestMatchRoute:
    URL = "/words/match"

    def test_requires_auth(self, client) -> None:
        r = client.post(self.URL, json={"word": "planes", "required": "plane", "language": "en"})
        assert r.status_code == 401

    def test_missing_language_returns_400(self, auth_client) -> None:
        r = auth_client.post(self.URL, json={"word": "planes", "required": "plane"})
        assert r.status_code == 400

    def test_identical_words_match_without_model(self, auth_client) -> None:
        # Identical short-circuits, so this works even with the model disabled.
        r = auth_client.post(
            self.URL, json={"word": "plane", "required": "plane", "language": "en"}
        )
        assert r.status_code == 200
        body = r.json()
        assert body == {"language": "en", "valid": True, "score": 1.0}

    def test_variant_matches_lookalike_does_not(self, auth_client, monkeypatch) -> None:
        _install_stub(
            monkeypatch,
            table={"plane": [1.0, 0.0], "planes": [0.99, 0.1], "planet": [0.5, 0.866]},
        )
        ok = auth_client.post(
            self.URL, json={"word": "planes", "required": "plane", "language": "en"}
        ).json()
        assert ok["valid"] is True
        nope = auth_client.post(
            self.URL, json={"word": "planet", "required": "plane", "language": "en"}
        ).json()
        assert nope["valid"] is False
