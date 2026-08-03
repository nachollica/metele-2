"""
Tests for the quote curation helpers + verifier.

The normalizer is the build-only contract that keeps stored quote blocks in step
with their raw source slices, so it gets the most attention. The verifier is
exercised against a synthetic source file + JSONL written to a tmp dir (no
dependency on the real, gitignored corpus).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import quotes
from quotes import (
    KIND_DIALOGUE,
    KIND_PROSE,
    KIND_STATEMENT,
    classify,
    iter_paragraphs,
    md5_of_file,
    normalize_quote,
    verify_quotes,
)


class TestNormalizeQuote:
    def test_joins_soft_wrap_within_a_paragraph(self) -> None:
        raw = "The map was\naccurate — until\nyesterday."
        assert normalize_quote(raw) == ["The map was accurate — until yesterday."]

    def test_blank_lines_become_separate_blocks(self) -> None:
        raw = "“Who are you?”\nsaid the Caterpillar.\n\n“I hardly know,\nsir.”"
        assert normalize_quote(raw) == [
            "“Who are you?” said the Caterpillar.",
            "“I hardly know, sir.”",
        ]

    def test_collapses_multiple_blank_lines_and_trims(self) -> None:
        raw = "\n\n  First.  \n\n\n  Second.\n\n"
        assert normalize_quote(raw) == ["First.", "Second."]

    def test_flat_blob_stays_one_block(self) -> None:
        raw = "A single flattened blob with no newlines at all, as in the HF mirror."
        assert normalize_quote(raw) == [raw]

    def test_never_alters_words(self) -> None:
        raw = "don't  change   these—words"
        assert normalize_quote(raw) == ["don't change these—words"]


class TestClassify:
    def test_single_sentence_is_statement(self) -> None:
        assert classify(["The last light in the city refuses to go out."]) == KIND_STATEMENT

    def test_multi_sentence_single_block_is_prose(self) -> None:
        assert classify(["It was cold. The fire had died. No one spoke."]) == KIND_PROSE

    def test_multi_block_with_quotes_is_dialogue(self) -> None:
        assert classify(["“Yes?” he asked.", "“No,” she said."]) == KIND_DIALOGUE

    def test_multi_block_without_quotes_is_prose(self) -> None:
        assert classify(["First paragraph.", "Second paragraph."]) == KIND_PROSE


class TestIterParagraphs:
    def test_offsets_bound_only_real_content(self) -> None:
        text = "First para.\n\n  Second para spanning\n  two lines.\n\nThird."
        paras = iter_paragraphs(text)
        assert [p.index for p in paras] == [0, 1, 2]
        for para in paras:
            # tightened: no leading/trailing whitespace at the offsets
            assert not text[para.char_start].isspace()
            assert not text[para.char_end - 1].isspace()
            assert text[para.char_start : para.char_end] == para.text
        assert paras[1].blocks == ["Second para spanning two lines."]

    def test_dialogue_run_spans_paragraphs(self) -> None:
        text = "“One.”\n\n“Two.”\n\nnarration"
        paras = iter_paragraphs(text)
        # A curated dialogue run: first para start → second para end.
        raw = text[paras[0].char_start : paras[1].char_end]
        assert normalize_quote(raw) == ["“One.”", "“Two.”"]


def _write_source(tmp_path: Path, rel: str, body: str) -> Path:
    path = tmp_path / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


@pytest.fixture
def corpus(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the quotes module at a synthetic datasets dir under tmp_path."""
    datasets = tmp_path / "datasets"
    datasets.mkdir()
    monkeypatch.setattr(quotes, "datasets_dir", lambda: str(datasets))
    return datasets


def _row(source_body: str, datasets: Path, **overrides: object) -> dict:
    rel = "book/content.txt"
    _write_source(datasets, rel, source_body)
    start = source_body.index("Real")
    end = start + len("Real quote.")
    blocks = normalize_quote(source_body[start:end])
    row: dict = {
        "id": "book-0001",
        "author": "A. Author",
        "source": "A Book",
        "kind": classify(blocks),
        "lang_source": "en",
        "origin": {
            "file": rel,
            "md5": md5_of_file(datasets / rel),
            "char_start": start,
            "char_end": end,
        },
        "text": {"en": blocks},
    }
    row.update(overrides)
    return row


def _write_jsonl(tmp_path: Path, rows: list[dict]) -> Path:
    path = tmp_path / "quotes.v1.jsonl"
    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", "utf-8")
    return path


class TestVerifyQuotes:
    SRC = "Header noise.\n\nReal quote.\n\nMore noise."

    def test_valid_row_passes(self, tmp_path: Path, corpus: Path) -> None:
        jsonl = _write_jsonl(tmp_path, [_row(self.SRC, corpus)])
        assert verify_quotes(jsonl) == []

    def test_text_drift_is_flagged(self, tmp_path: Path, corpus: Path) -> None:
        row = _row(self.SRC, corpus)
        row["text"]["en"] = ["Something else."]
        jsonl = _write_jsonl(tmp_path, [row])
        problems = verify_quotes(jsonl)
        assert any("does not match" in p for p in problems)

    def test_md5_drift_is_flagged(self, tmp_path: Path, corpus: Path) -> None:
        row = _row(self.SRC, corpus)
        row["origin"]["md5"] = "0" * 32
        jsonl = _write_jsonl(tmp_path, [row])
        problems = verify_quotes(jsonl)
        assert any("md5 drift" in p for p in problems)

    def test_bad_kind_is_flagged(self, tmp_path: Path, corpus: Path) -> None:
        jsonl = _write_jsonl(tmp_path, [_row(self.SRC, corpus, kind="epic")])
        assert any("kind" in p for p in verify_quotes(jsonl))

    def test_duplicate_id_is_flagged(self, tmp_path: Path, corpus: Path) -> None:
        jsonl = _write_jsonl(tmp_path, [_row(self.SRC, corpus), _row(self.SRC, corpus)])
        assert any("duplicate id" in p for p in verify_quotes(jsonl))

    def test_missing_lang_source_text_is_flagged(self, tmp_path: Path, corpus: Path) -> None:
        row = _row(self.SRC, corpus, lang_source="fr")
        jsonl = _write_jsonl(tmp_path, [row])
        assert any("lang_source" in p for p in verify_quotes(jsonl))

    def test_source_i18n_translation_passes(self, tmp_path: Path, corpus: Path) -> None:
        row = _row(self.SRC, corpus, source_i18n={"es": "Un Libro"})
        assert verify_quotes(_write_jsonl(tmp_path, [row])) == []

    def test_source_i18n_repeating_source_language_is_flagged(
        self, tmp_path: Path, corpus: Path
    ) -> None:
        row = _row(self.SRC, corpus, source_i18n={"en": "A Book"})
        assert any("must not repeat" in p for p in verify_quotes(_write_jsonl(tmp_path, [row])))

    def test_source_i18n_unknown_language_is_flagged(self, tmp_path: Path, corpus: Path) -> None:
        row = _row(self.SRC, corpus, source_i18n={"fr": "Un Livre"})
        assert any("unknown language" in p for p in verify_quotes(_write_jsonl(tmp_path, [row])))

    def test_source_i18n_empty_title_is_flagged(self, tmp_path: Path, corpus: Path) -> None:
        row = _row(self.SRC, corpus, source_i18n={"es": "  "})
        assert any("non-empty string" in p for p in verify_quotes(_write_jsonl(tmp_path, [row])))
