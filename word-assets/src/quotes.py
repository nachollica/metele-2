"""
Quote-of-the-day artifact: curation helpers + integrity verifier.

The frontend shows a rotating literary "quote of the day" (see
``frontend/components/flowfic/inspiration-panel.tsx``). Its source of truth is a
hand-curated JSON Lines file, ``frontend/public/quotes/quotes.vN.jsonl`` — one
quote per line, committed (it is small, curated content, not a generated blob).

This module owns the build-only pieces:

- :func:`normalize_quote` — the soft-wrap normalizer. Project Gutenberg ``.txt``
  files hard-wrap prose at ~70 columns with blank-line paragraph breaks; the
  HuggingFace ``gutenberg8k`` mirror flattens all newlines into one blob. The
  normalizer turns a raw slice into a list of *paragraph blocks*: mid-paragraph
  soft-wrap newlines are joined into spaces, blank-line breaks become separate
  blocks. Words are never altered — only mechanical whitespace. The frontend
  renders each block as its own line, so multi-block dialogue reads correctly.
- :func:`md5_of_file` — provenance hash recorded per quote, so a re-downloaded
  source can be checked for drift.
- :func:`iter_paragraphs` — slices a source file into paragraph spans with exact
  character offsets, the raw material a curator (human or agent) picks from.
- :func:`classify` — a consistent ``kind`` tag (statement / prose / dialogue).
- :func:`load_quotes` / :func:`verify_quotes` — read the JSONL and assert every
  row is internally consistent and still matches its (md5-checked) source slice.

The verify path is the contract that keeps the committed file honest: for each
row, re-read ``origin.file``, confirm its md5, slice ``[char_start:char_end]``,
re-normalize, and require it to equal the stored source-language text blocks.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

from contract import datasets_dir

# Consistent ``kind`` vocabulary. Recorded per quote (not shown in the UI yet);
# a curator may override the heuristic guess from :func:`classify`.
KIND_STATEMENT = "statement"  # single block, single sentence / aphorism
KIND_PROSE = "prose"  # single block, multi-sentence — or multi-block narration
KIND_DIALOGUE = "dialogue"  # multi-block exchange carrying quotation marks
KINDS: tuple[str, ...] = (KIND_STATEMENT, KIND_PROSE, KIND_DIALOGUE)

# Any of these opening/closing quotation marks flags spoken dialogue.
_QUOTE_CHARS = '"“”«»'
_BLANK_LINE_RE = re.compile(r"\n[ \t]*\n+")
_WHITESPACE_RE = re.compile(r"\s+")
_SENTENCE_END_RE = re.compile(r"[.!?]+(?:\s|$)")


# ---------------------------------------------------------------------------
# Normalisation (the build-only contract)
# ---------------------------------------------------------------------------


def normalize_quote(raw: str) -> list[str]:
    """
    Turn a raw source slice into display paragraph blocks.

    Splits on blank lines into paragraphs, then collapses each paragraph's
    internal whitespace (soft-wrap newlines included) to single spaces. Empty
    paragraphs are dropped. A blob with no newlines (the HF mirror) yields a
    single block. No word is ever changed — this only removes mechanical wrap.
    """
    blocks: list[str] = []
    for para in _BLANK_LINE_RE.split(raw):
        collapsed = _WHITESPACE_RE.sub(" ", para).strip()
        if collapsed:
            blocks.append(collapsed)
    return blocks


def classify(blocks: list[str]) -> str:
    """Heuristic ``kind`` for a normalized quote (see the KIND_* constants)."""
    has_quotes = any(ch in "".join(blocks) for ch in _QUOTE_CHARS)
    if len(blocks) >= 2:
        return KIND_DIALOGUE if has_quotes else KIND_PROSE
    if not blocks:
        return KIND_PROSE
    sentences = len(_SENTENCE_END_RE.findall(blocks[0]))
    return KIND_STATEMENT if sentences <= 1 else KIND_PROSE


# ---------------------------------------------------------------------------
# Provenance
# ---------------------------------------------------------------------------


def md5_of_file(path: str | Path) -> str:
    """Hex md5 of a source file's bytes (recorded in each quote's ``origin``)."""
    digest = hashlib.md5()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_source(rel_path: str) -> Path:
    """Resolve a quote's ``origin.file`` (relative to the datasets dir)."""
    return Path(datasets_dir()) / rel_path


# ---------------------------------------------------------------------------
# Candidate slicing (curation input)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Paragraph:
    """One paragraph-sized span of a source file, with exact char offsets."""

    index: int
    char_start: int
    char_end: int
    text: str  # the raw slice, text[char_start:char_end]

    @property
    def blocks(self) -> list[str]:
        return normalize_quote(self.text)

    @property
    def kind(self) -> str:
        return classify(self.blocks)


def _tighten(text: str, start: int, end: int) -> tuple[int, int]:
    """Trim leading/trailing whitespace so offsets bound only real content."""
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    return start, end


def iter_paragraphs(text: str) -> list[Paragraph]:
    """
    Split raw file text into paragraph spans (blank-line separated), each with
    tightened character offsets into ``text``.

    A dialogue exchange spanning consecutive paragraphs is curated by taking the
    ``char_start`` of the first and the ``char_end`` of the last: the raw slice
    then still contains the blank-line breaks, and :func:`normalize_quote` splits
    it back into one block per turn.
    """
    out: list[Paragraph] = []
    cursor = 0
    index = 0
    seps = [(m.start(), m.end()) for m in _BLANK_LINE_RE.finditer(text)]
    for sep_start, sep_end in (*seps, (len(text), len(text))):
        start, end = _tighten(text, cursor, sep_start)
        if start < end:
            out.append(Paragraph(index=index, char_start=start, char_end=end, text=text[start:end]))
            index += 1
        cursor = sep_end
    return out


def read_source(rel_path: str) -> str:
    """Read a source file as UTF-8 text (the same read offsets index into)."""
    return resolve_source(rel_path).read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# JSONL load + verify
# ---------------------------------------------------------------------------


def load_quotes(path: str | Path) -> list[dict]:
    """Parse the quotes JSONL into a list of raw dicts (one per non-blank line)."""
    quotes: list[dict] = []
    for lineno, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            quotes.append(json.loads(stripped))
        except json.JSONDecodeError as exc:  # pragma: no cover - message plumbing
            raise ValueError(f"{path}:{lineno}: invalid JSON: {exc}") from exc
    return quotes


def _verify_quote(quote: dict) -> list[str]:
    """Return a list of human-readable problems with one quote row (empty = ok)."""
    qid = quote.get("id", "<no id>")
    problems: list[str] = []

    for field in ("id", "author", "source", "kind", "lang_source", "origin", "text"):
        if field not in quote:
            problems.append(f"{qid}: missing field {field!r}")
    if problems:
        return problems

    if quote["kind"] not in KINDS:
        problems.append(f"{qid}: kind {quote['kind']!r} not in {KINDS}")

    text = quote["text"]
    lang_source = quote["lang_source"]
    if not isinstance(text, dict) or not text:
        problems.append(f"{qid}: text must be a non-empty object of language → block list")
        return problems
    if lang_source not in text:
        problems.append(f"{qid}: lang_source {lang_source!r} has no text entry")
    for lang, blocks in text.items():
        if (
            not isinstance(blocks, list)
            or not blocks
            or not all(isinstance(b, str) for b in blocks)
        ):
            problems.append(f"{qid}: text[{lang!r}] must be a non-empty list of strings")

    origin = quote["origin"]
    for field in ("file", "md5", "char_start", "char_end"):
        if field not in origin:
            problems.append(f"{qid}: origin missing field {field!r}")
    if problems:
        return problems

    src_path = resolve_source(origin["file"])
    if not src_path.exists():
        problems.append(f"{qid}: source file not found: {origin['file']}")
        return problems

    actual_md5 = md5_of_file(src_path)
    if actual_md5 != origin["md5"]:
        problems.append(
            f"{qid}: source md5 drift for {origin['file']}: "
            f"recorded {origin['md5']}, file is {actual_md5}"
        )
        # A drifted file makes the offset check meaningless; stop here.
        return problems

    raw = src_path.read_text(encoding="utf-8")
    start, end = origin["char_start"], origin["char_end"]
    if not (0 <= start < end <= len(raw)):
        problems.append(f"{qid}: char offsets [{start}:{end}] out of range (len {len(raw)})")
        return problems

    expected = normalize_quote(raw[start:end])
    if expected != text.get(lang_source):
        problems.append(
            f"{qid}: text[{lang_source!r}] does not match the normalized source slice "
            f"[{start}:{end}]\n    slice → {expected}\n    stored → {text.get(lang_source)}"
        )

    return problems


def verify_quotes(path: str | Path) -> list[str]:
    """
    Verify the whole quotes JSONL. Returns a flat list of problems (empty = ok).

    Checks structure, the ``kind`` vocabulary, per-language block shape, source
    md5, offset range, and that the source-language text equals the re-normalized
    raw slice. Duplicate ids are also reported.
    """
    quotes = load_quotes(path)
    problems: list[str] = []
    seen: set[str] = set()
    for quote in quotes:
        qid = quote.get("id")
        if isinstance(qid, str):
            if qid in seen:
                problems.append(f"{qid}: duplicate id")
            seen.add(qid)
        problems.extend(_verify_quote(quote))
    return problems
