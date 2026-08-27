"""
Helpers for wiring the word engine to tiny synthetic artifacts in tests.

The real vector pools are built offline from fastText and committed; the suite
instead writes a handful of words (with deterministic unit vectors) into a temp
dir and points the engine there, so tests stay fast, offline, and free of the
heavy build-only dependencies.
"""

from __future__ import annotations

import os

import numpy as np

from app.word_engine import Language, WordConfig, _pool_path, configure

# Default per-language pools — enough common words for the random/route tests.
DEFAULT_ES = ["gato", "perro", "casa", "comida", "mesa", "silla", "arbol", "flor", "rojo", "roja"]
DEFAULT_EN = ["dog", "cat", "house", "garden", "tree", "table", "chair", "water", "plane", "cloud"]


def _unit_rows(count: int, dim: int = 8) -> np.ndarray:
    """Deterministic, reproducible unit vectors (seeded on the row count)."""
    rng = np.random.default_rng(count)
    vectors = rng.standard_normal((count, dim)).astype(np.float32)
    return vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-9)


def write_pool(
    data_dir: str,
    language: Language,
    words: list[str],
    *,
    vectors: list[list[float]] | None = None,
    zipf: list[float] | None = None,
) -> None:
    """
    Write a ``word_pool/{lang}.npz`` matching the real int8-quantized format
    (see ``word-assets/src/pool.py``'s ``build_pool``, the canonical writer).
    """
    rows = _unit_rows(len(words)) if vectors is None else np.asarray(vectors, dtype=np.float32)
    rows = rows / np.maximum(np.linalg.norm(rows, axis=1, keepdims=True), 1e-9)
    zipfs = [4.0] * len(words) if zipf is None else zipf
    max_abs = float(np.abs(rows).max()) if rows.size else 1.0
    scale = 127.0 / max_abs if max_abs > 0 else 1.0
    quantized = np.clip(np.round(rows * scale), -127, 127).astype(np.int8)
    path = _pool_path(data_dir, language)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    np.savez(
        path,
        words=np.asarray(words, dtype=object),
        vectors=quantized,
        scale=np.float32(scale),
        zipf=np.asarray(zipfs, dtype=np.float16),
    )


def reconfigure(data_dir: str, **overrides: object) -> None:
    """Point the engine at ``data_dir`` (dropping any cached pools)."""
    configure(WordConfig(data_dir=data_dir, **overrides))  # type: ignore[arg-type]
