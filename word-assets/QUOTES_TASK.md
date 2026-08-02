# Task: build the "quote of the day" pool

This is a self-contained brief for an agent (or a person) to curate the literary
quote pool the Flowfic landing dashboard rotates through. All the tooling,
schema, and verification already exist — your job is the curation and
translation.

## Goal

Produce `frontend/public/quotes/quotes.v1.jsonl` — roughly **40 quotes**, one
JSON object per line, hand-picked verbatim from public-domain literature, each
with an English original and a faithful Spanish translation. **Maximize author
and topic variety.** A placeholder file with a single sample entry already exists
there (a Lewis Carroll quote); **replace it** with your curated set (you may keep
that entry if it's good).

When you're done, `just word-assets::quotes-verify` must pass with ~40 quotes.

## Context you need

- Run everything from the `word-assets/` directory (its own `uv` venv).
- Sources live under `word-assets/nlp_literature_datasets/` (already downloaded
  by `download_datasets.py`). Two families, with an important difference:
  - `direct_requests/` — 4 books as raw Project Gutenberg `.txt` (Austen
    *Pride and Prejudice*, Shelley *Frankenstein*, Carroll *Alice in Wonderland*,
    Doyle *The Adventures of Sherlock Holmes*). These **keep paragraph
    structure** (blank-line separated), so they are the **only** source that can
    give you real **multi-line dialogue**.
  - `hf_gutenberg/` — 100 books whose text is **flattened** (all newlines
    stripped into one blob). Great for author variety, but every quote from here
    is a single prose block — no dialogue structure.
- Ignore `download_hathi.py` / `hathitrust_extracted_features/`: that is
  aggregated word-frequency data, not full text, so it is not a quote source.
- Do **not** pick from the Project Gutenberg license header/footer boilerplate
  (the `*** START/END OF THE PROJECT GUTENBERG EBOOK ***` markers and everything
  outside them). Quote only the actual work.

## The schema (one JSON object per line)

```json
{
  "id": "carroll-alice-in-wonderland-0001",
  "author": "Lewis Carroll",
  "source": "Alice's Adventures in Wonderland",
  "kind": "dialogue",
  "lang_source": "en",
  "origin": {
    "file": "direct_requests/Lewis Carroll/Alice in Wonderland/content.txt",
    "md5": "f81633d36dcd775bfd222f4c9dcede02",
    "char_start": 13650,
    "char_end": 13970
  },
  "text": {
    "en": ["first paragraph block", "second speaker's block"],
    "es": ["primer bloque", "bloque del segundo interlocutor"]
  }
}
```

Field rules:

- `id`: stable slug, `"<author-slug>-<source-slug>-NNNN"`, unique across the file.
- `author`, `source`: human-readable; `source` is the work's title.
- `kind`: one of `statement` (single sentence / aphorism), `prose` (multi-sentence
  single block, or narration), `dialogue` (multi-block exchange with quotation
  marks). Recorded for future features, not shown in the UI. The slicer suggests
  one — use its suggestion unless your judgment disagrees. **Be consistent.**
- `lang_source`: the language you took the quote from verbatim — `"en"` for every
  quote in this corpus.
- `origin.file`: path **relative to `nlp_literature_datasets/`**.
- `origin.md5`: md5 of that source file (the slicer prints it; do not invent it).
- `origin.char_start` / `char_end`: byte-offset range into a raw UTF-8
  `read()` of the file. **Copy these from the slicer — never eyeball them.**
- `text`: language → array of **paragraph blocks**. One element per line/turn: a
  single statement is a one-element array; a dialogue exchange has several. The
  `text[lang_source]` array must equal the normalized source slice (the verifier
  enforces this). `text.es` is your translation, same block structure.

### Verbatim + newline policy (important)

Store the source-language words **exactly** — never rephrase, modernize, or fix
spelling. The **only** transformation is mechanical de-wrapping, done for you by
the normalizer (`normalize_quote` in `src/quotes.py`): mid-paragraph hard-wrap
newlines collapse to spaces; blank-line breaks become separate blocks. Because
you copy offsets from the slicer and let the tool normalize, `text.en` will
always match — the verifier re-reads the slice, re-normalizes, and compares.

## Workflow

1. Pick a source file. List candidate paragraphs with offsets, preview, and a
   `kind` guess (longest first, tune `--min-chars/--max-chars/--limit`):

   ```bash
   just word-assets::slice-quotes "direct_requests/Lewis Carroll/Alice in Wonderland/content.txt"
   just word-assets::slice-quotes "hf_gutenberg/Homer/The Odyssey/content.txt" --max-chars 400
   ```

2. Read the previews and pick genuinely good quotes — strong metaphors, wisdom,
   mystery, memorable dialogue, wit. Quality over quantity; over-picking a little
   is fine (rows can be pruned later), but keep the bar high.

3. For a **dialogue run** spanning consecutive paragraphs, take `char_start` of
   the first turn and `char_end` of the last. Confirm the exact slice and get a
   ready-made JSON row (with md5 + normalized blocks) via:

   ```bash
   just word-assets::slice-quotes "<rel/path>" --start <START> --end <END>
   ```

4. Build each JSONL line from that output: add `id`, `author`, `source`, refine
   `kind` if needed, and add `text.es` with your own faithful Spanish
   translation (mirror the block structure; for dialogue prefer Spanish dash
   conventions). **Do not copy any existing third-party (copyrighted)
   translation — translate it yourself.**

5. Aim for breadth: spread across many authors/books from both `direct_requests/`
   (for dialogue) and a wide sample of `hf_gutenberg/` (for prose variety —
   e.g. Homer, Nietzsche, Emerson, Whitman, Dickens-era novels, adventure,
   fantasy). Vary `kind` too.

6. Write all lines to `frontend/public/quotes/quotes.v1.jsonl` (one compact JSON
   object per line, UTF-8, `ensure_ascii=False`, no indentation).

7. Verify:

   ```bash
   just word-assets::quotes-verify
   ```

   Fix anything it reports (offset/md5/kind/shape/text-mismatch/duplicate-id).

## Tips

- To emit exact bytes for `text.en`, prefer generating rows programmatically with
  the helpers in `src/quotes.py` (`normalize_quote`, `md5_of_file`,
  `resolve_source`, `read_source`, `classify`) rather than hand-typing the text —
  that guarantees the verifier passes. See how the current sample was produced.
- Keep each quote reasonably short (a sentence up to a short paragraph, or a
  brief dialogue exchange) so it reads well in a dashboard card.
- If a source's md5 changes later (re-download), the verifier flags it; refresh
  the offsets/md5 for that book's rows.

## Definition of done

- `frontend/public/quotes/quotes.v1.jsonl` has ~40 varied, high-quality quotes.
- Every row has both `en` and `es` text.
- `just word-assets::quotes-verify` passes.
- No schema/versioning changes were needed (adding languages later = adding a key
  under `text`; a format change would require bumping `QUOTES_VERSION` in both
  `word-assets/src/contract.py` and `frontend/lib/flowfic/quotes.ts`).
