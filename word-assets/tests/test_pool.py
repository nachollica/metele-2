"""
Tests for the int8 quantization step in ``pool.py``.

``build_pool`` itself needs a real fastText source plus the wordfreq/simplemma
dictionaries, so it is exercised by a real build rather than a unit test.
``quantize_matrix`` is the pure arithmetic pulled out of it, and is where a
mistake here would actually surface: a wrong scale corrupts every stored
vector, silently, since the backend has no way to know the number it read back
should have been different.
"""

from __future__ import annotations

import numpy as np

from pool import quantize_matrix


class TestQuantizeMatrix:
    def test_round_trips_within_int8_resolution(self) -> None:
        matrix = np.array([[1.0, 0.0], [0.6, 0.8], [-0.6, 0.8]], dtype=np.float32)
        quantized, scale = quantize_matrix(matrix)
        dequantized = quantized.astype(np.float32) / scale
        # Rounding to the nearest int8 level can be off by at most half a
        # quantization step (1/scale); here max|component| is 1.0, so
        # scale == 127 and the worst possible error is 1/254 ≈ 0.0039.
        assert np.abs(dequantized - matrix).max() < 1 / (2 * scale) + 1e-6

    def test_output_dtype_is_int8(self) -> None:
        matrix = np.array([[1.0, 0.0]], dtype=np.float32)
        quantized, _ = quantize_matrix(matrix)
        assert quantized.dtype == np.int8

    def test_never_clips_a_unit_norm_vector(self) -> None:
        # Every component of an L2-normalised vector is in [-1, 1] by
        # definition (the squares of all components sum to 1), so the derived
        # scale must always be large enough that rounding stays inside the
        # signed int8 range — landing exactly on +/-127 (the row holding the
        # actual max component) is correct use of the full range, not clipping.
        rng = np.random.default_rng(0)
        raw = rng.standard_normal((200, 300)).astype(np.float32)
        raw /= np.linalg.norm(raw, axis=1, keepdims=True)
        quantized, _ = quantize_matrix(raw)
        assert quantized.min() >= -127
        assert quantized.max() <= 127

    def test_uses_the_full_int8_range_when_components_run_small(self) -> None:
        # Real fastText components run well under 1 (observed max ~0.5 on the
        # real es pool) — an adaptive scale should still reach close to the
        # full range rather than wasting most of it, unlike a fixed scale of
        # 127 would.
        matrix = np.full((5, 4), 0.1, dtype=np.float32)
        matrix[0, 0] = 0.5  # the actual max component in this matrix
        quantized, scale = quantize_matrix(matrix)
        assert quantized.max() == 127
        assert scale == 127.0 / 0.5

    def test_empty_matrix_gets_a_safe_nonzero_scale(self) -> None:
        empty = np.zeros((0, 300), dtype=np.float32)
        quantized, scale = quantize_matrix(empty)
        assert quantized.shape == (0, 300)
        assert scale > 0

    def test_all_zero_matrix_gets_a_safe_nonzero_scale(self) -> None:
        # A degenerate all-zero row would otherwise divide 127 by 0.
        zeros = np.zeros((3, 4), dtype=np.float32)
        quantized, scale = quantize_matrix(zeros)
        assert scale > 0
        assert (quantized == 0).all()
