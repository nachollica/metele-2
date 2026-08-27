"""Tests for the words endpoints and the static-vector word engine."""

from __future__ import annotations

import numpy as np
import pytest

from app import word_engine
from app.word_engine import (
    Language,
    ensure_ready,
    expand_related,
    is_common,
    loaded_pool_sizes,
    parse_accept_language,
    random_words,
)
from tests.word_fixtures import DEFAULT_EN, DEFAULT_ES, reconfigure, write_pool

# ---- parse_accept_language ---------------------------------------------


class TestParseAcceptLanguage:
    def test_returns_none_for_missing_or_blank(self) -> None:
        assert parse_accept_language(None) is None
        assert parse_accept_language("") is None
        assert parse_accept_language("   ") is None

    def test_picks_first_supported_tag(self) -> None:
        assert parse_accept_language("en-US,en;q=0.9") is Language.EN
        assert parse_accept_language("es-AR,es;q=0.9,en;q=0.5") is Language.ES

    def test_currently_unsupported_languages_fall_through(self) -> None:
        # Scoped to en/es for now; other locales are not offered yet. A supported
        # tag later in the header still wins.
        assert parse_accept_language("fr-FR") is None
        assert parse_accept_language("de,es;q=0.5") is Language.ES

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


# ---- is_common ---------------------------------------------------------


class TestIsCommon:
    def test_pool_word_is_common(self) -> None:
        assert is_common("gato", Language.ES)  # default pool, zipf 4.0

    def test_min_zipf_can_raise_the_floor(self) -> None:
        assert not is_common("gato", Language.ES, min_zipf=5.0)

    def test_word_absent_from_pool_is_not_common(self) -> None:
        assert not is_common("zzqqx", Language.ES)


# ---- expand_related ----------------------------------------------------


class TestExpandRelated:
    ES = Language.ES

    # 3-D geometry: seeds "alpha" (axis 0) and "beta" (axis 1). Alpha's
    # neighbours score very high; beta's lower but above the 0.25 floor; "zzz" is
    # unrelated to both; "alphas" is a prefix variant of the seed.
    WORDS = ["alpha", "beta", "wolf", "bear", "alphas", "table", "chair", "zzz"]
    VECTORS = [
        [1.0, 0.0, 0.0],  # alpha
        [0.0, 1.0, 0.0],  # beta
        [0.99, 0.141, 0.0],  # wolf   cos(alpha) ~ 0.99
        [0.98, 0.199, 0.0],  # bear   cos(alpha) ~ 0.98
        [0.995, 0.1, 0.0],  # alphas prefix variant of the seed
        [0.0, 0.7, 0.714],  # table  cos(beta) ~ 0.70
        [0.0, 0.6, 0.8],  # chair  cos(beta) ~ 0.60
        [0.0, 0.0, 1.0],  # zzz    unrelated to both
    ]

    def _install(self, data_dir: str, *, random_fraction: float = 0.0) -> None:
        # random_fraction 0 by default so the themed portion is deterministic.
        write_pool(data_dir, self.ES, self.WORDS, vectors=self.VECTORS)
        reconfigure(data_dir, random_fraction=random_fraction, min_similarity=0.25)

    def test_themed_neighbours_of_all_seeds(self, word_data_dir: str) -> None:
        self._install(word_data_dir)
        result = set(expand_related(["alpha", "beta"], self.ES, limit=4, min_zipf=0.0))
        assert result == {"wolf", "bear", "table", "chair"}
        assert "zzz" not in result  # below the similarity floor for both

    def test_excludes_seeds_and_prefix_variants(self, word_data_dir: str) -> None:
        self._install(word_data_dir)
        result = expand_related(["alpha", "beta"], self.ES, limit=4, min_zipf=0.0)
        assert "alphas" not in result  # prefix variant of "alpha"
        assert "alpha" not in result
        assert "beta" not in result

    def test_respects_limit(self, word_data_dir: str) -> None:
        self._install(word_data_dir)
        assert len(expand_related(["alpha", "beta"], self.ES, limit=3, min_zipf=0.0)) == 3

    def test_random_fill_mixes_in_unrelated_words(self, word_data_dir: str) -> None:
        # With headroom above the themed neighbours, the pool is topped up with
        # random words (variety is the point) — here "zzz"/"alphas" can appear.
        self._install(word_data_dir, random_fraction=0.5)
        result = expand_related(["alpha", "beta"], self.ES, limit=6, min_zipf=0.0)
        assert len(result) == 6  # all six non-seed pool words
        assert {"zzz", "alphas"} <= set(result)

    def test_unresolved_seeds_fall_back_to_random_pool(self, word_data_dir: str) -> None:
        # Seed not in the pool → no themed neighbours → a random pool sample.
        result = expand_related(["qqzzx"], Language.EN, limit=3)
        assert len(result) == 3

    def test_degrades_to_empty_without_a_pool(self) -> None:
        reconfigure("/nonexistent-flowfic-word-data")
        assert expand_related(["alpha"], self.ES, limit=5) == []

    def test_blank_and_empty_inputs(self, word_data_dir: str) -> None:
        self._install(word_data_dir)
        assert expand_related(["   "], self.ES, limit=5, min_zipf=0.0) == []
        assert expand_related(["alpha"], self.ES, limit=0, min_zipf=0.0) == []


# ---- int8 quantization + the chunked matmul -----------------------------
#
# expand_related's ranking tests above already exercise this path end-to-end
# (write_pool quantizes, _load_pool reads int8 back, _cosine_similarities does
# the chunked dequantized matmul), so a broken round-trip would already show up
# as a wrong nearest-neighbour there. These tests target what that coverage
# cannot see: the actual cosine *values* (not just their ranking), the RAM
# dtype contract that is the entire point of this change, and the chunk
# boundary itself — every existing fixture pool is smaller than one chunk, so
# only a multi-chunk pool can catch an off-by-one at the boundary.


class TestCosineSimilarities:
    ES = Language.ES

    def test_matches_true_cosine_within_int8_precision(self, word_data_dir: str) -> None:
        # Two orthogonal-ish unit vectors with a known true cosine similarity.
        vectors = [[1.0, 0.0], [0.6, 0.8]]  # true cosine(v0, v1) = 0.6
        write_pool(word_data_dir, self.ES, ["a", "b"], vectors=vectors)
        reconfigure(word_data_dir)
        pool = word_engine._load_pool(self.ES)
        sims = word_engine._cosine_similarities(pool, seed_rows=[0])
        assert sims.shape == (2, 1)
        # Worst-case rounding error per component is half a quantization step
        # (1/scale); here max|component| is 1.0 so scale == 127, and a dot
        # product of 2 components can be off by up to 2 * 1/(2*127) ≈ 0.0079.
        tol = 2 / (2 * pool.scale) + 1e-6
        assert sims[0, 0] == pytest.approx(1.0, abs=tol)  # self-similarity
        assert sims[1, 0] == pytest.approx(0.6, abs=tol)

    def test_pool_matrix_stays_int8_in_ram(self, word_data_dir: str) -> None:
        # The whole point of this change: the resident matrix must never be
        # widened to float32 (a 4x memory cost held for the life of the worker).
        # A future edit that reintroduces the old upcast would pass every
        # ranking test above while quietly reverting the memory fix — this
        # assertion is what would actually catch that.
        write_pool(word_data_dir, self.ES, ["a", "b"], vectors=[[1.0, 0.0], [0.0, 1.0]])
        reconfigure(word_data_dir)
        pool = word_engine._load_pool(self.ES)
        assert pool.matrix.dtype == np.int8

    def test_chunk_boundary_matches_a_single_pass(
        self, word_data_dir: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Force multiple chunks over a pool that would otherwise fit in one, and
        # confirm the chunked result is identical to computing it in a single
        # pass — an off-by-one at the boundary would silently corrupt one row's
        # similarities rather than raising, so this compares actual values.
        rng = np.random.default_rng(0)
        n = 23
        raw = rng.standard_normal((n, 5)).astype(np.float32)
        raw /= np.linalg.norm(raw, axis=1, keepdims=True)
        write_pool(word_data_dir, self.ES, [f"w{i}" for i in range(n)], vectors=raw.tolist())
        reconfigure(word_data_dir)
        pool = word_engine._load_pool(self.ES)

        monkeypatch.setattr(word_engine, "_SIMILARITY_CHUNK_ROWS", n)
        single_pass = word_engine._cosine_similarities(pool, seed_rows=[0, 3])
        monkeypatch.setattr(word_engine, "_SIMILARITY_CHUNK_ROWS", 7)  # 23 / 7 -> 4 chunks
        chunked = word_engine._cosine_similarities(pool, seed_rows=[0, 3])

        # Not exact equality: summing in a different chunk grouping changes
        # float32 rounding at the ULP level (observed ~6e-8, float32 epsilon
        # scale) — that is expected non-associativity, not a chunking bug.
        np.testing.assert_allclose(single_pass, chunked, rtol=1e-5, atol=1e-6)

    def test_empty_pool_uses_a_safe_default_scale(self) -> None:
        # `_load_pool` returns this PoolData for a missing artifact, never one
        # written by `write_pool` — scale must not be 0 (a real divide-by-zero)
        # even though nothing ever indexes into the empty matrix.
        reconfigure("/nonexistent-flowfic-word-data")
        pool = word_engine._load_pool(self.ES)
        assert pool.matrix.shape == (0, 0)
        assert pool.scale > 0


# ---- random_words ------------------------------------------------------


class TestRandomWords:
    def test_returns_non_empty_for_each_language(self) -> None:
        for lang in (Language.EN, Language.ES):
            assert random_words(lang, limit=20), f"empty random pool for {lang.value}"

    def test_respects_limit(self) -> None:
        assert len(random_words(Language.EN, limit=5)) == 5

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

    def test_degrades_to_empty_without_a_pool(self) -> None:
        reconfigure("/nonexistent-flowfic-word-data")
        assert random_words(Language.EN, limit=5) == []


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

    def test_response_shape_and_themed_expansion(self, auth_client, word_data_dir: str) -> None:
        write_pool(
            word_data_dir,
            Language.ES,
            ["perro", "gato", "lejano"],
            vectors=[[1.0, 0.0], [0.98, 0.199], [0.0, 1.0]],
        )
        reconfigure(word_data_dir, random_fraction=0.0, min_similarity=0.25)
        r = auth_client.post(self.URL, json={"words": ["perro"], "language": "es", "limit": 1})
        assert r.status_code == 200
        body = r.json()
        assert set(body.keys()) == {"language", "words"}
        assert body["language"] == "es"
        assert body["words"] == ["gato"]  # the themed neighbour, not "lejano"


# ---- POST /words/random ------------------------------------------------


class TestRandomWordsRoute:
    URL = "/words/random"

    def test_requires_auth(self, client) -> None:
        assert client.post(self.URL, json={"language": "en"}).status_code == 401

    def test_explicit_language_wins_over_header(self, auth_client) -> None:
        r = auth_client.post(
            self.URL, json={"language": "es", "limit": 20}, headers={"Accept-Language": "en"}
        )
        assert r.status_code == 200
        body = r.json()
        assert body["language"] == "es"
        assert body["words"]

    def test_missing_language_returns_400(self, auth_client) -> None:
        assert auth_client.post(self.URL, json={}).status_code == 400

    def test_response_shape(self, auth_client) -> None:
        r = auth_client.post(self.URL, json={"language": "en", "limit": 8})
        assert r.status_code == 200
        body = r.json()
        assert set(body.keys()) == {"language", "words"}
        assert len(body["words"]) <= 8


# ---- loaded_pool_sizes -------------------------------------------------


class TestLoadedPoolSizes:
    """
    The reporting helper behind ``/ping``'s ``wordPools``.

    Its whole point is that it observes without loading: ``/ping`` is
    unauthenticated, and on a small host a forced load would fault a
    multi-hundred-megabyte matrix in from swap on demand.
    """

    def test_reports_nothing_before_anything_is_loaded(self, word_data_dir) -> None:
        # The autouse fixture configures a data dir but `configure` drops the
        # cache, so no pool is resident until something asks for one.
        assert loaded_pool_sizes() == {}

    def test_does_not_load_a_pool_on_its_own(self, word_data_dir) -> None:
        loaded_pool_sizes()
        # Still empty: reporting must never be the thing that populates.
        assert loaded_pool_sizes() == {}

    def test_reports_word_counts_once_preloaded(self, word_data_dir) -> None:
        ensure_ready()
        assert loaded_pool_sizes() == {
            Language.EN.value: len(DEFAULT_EN),
            Language.ES.value: len(DEFAULT_ES),
        }

    def test_reports_only_pools_for_the_active_data_dir(self, tmp_path) -> None:
        # A reconfigure to a different dir must not report the previous dir's
        # pools as if they belonged to the live config.
        first = str(tmp_path / "first")
        write_pool(first, Language.EN, ["alpha", "beta"])
        reconfigure(first)
        ensure_ready(languages=(Language.EN,))
        assert loaded_pool_sizes() == {Language.EN.value: 2}

        second = str(tmp_path / "second")
        write_pool(second, Language.EN, ["gamma"])
        reconfigure(second)
        assert loaded_pool_sizes() == {}
