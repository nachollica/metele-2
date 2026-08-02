# word-assets

Build-time generator for Flowfic's word artifacts. It is a standalone `uv`
project (its own `.venv`), neither backend nor frontend, because the artifacts it
produces feed both:

| Artifact | Written to | Consumed by |
| --- | --- | --- |
| Vector pool `{lang}.vN.npz` | `backend/data/word_pool/` | backend runtime (related / random words) |
| Match map `{lang}.vN.json` | `frontend/public/match-map/` | frontend (word matching) |

The pipeline: fastText + wordfreq + simplemma + spaCy → `build_vectors` →
`word_pool.npz` → (a) backend runtime, and (b) `build_match_map` →
`match-map.json` → frontend. The vector pool is thus the shared source the match
map is derived from.

## The artifacts are gitignored

They are large binary/JSON files, so they are **not committed**
(`backend/data/word_pool/` and `frontend/public/match-map/` are gitignored). Both
downstream builds hard-fail if their artifact is missing (the backend Docker
build and the frontend `prebuild` step), so you can never ship a degraded build —
you just have to generate the artifacts first.

## Usage

```bash
just word-assets::init                              # install deps
just word-assets::vectors --fasttext-dir ~/fasttext # → backend/data/word_pool
just word-assets::match-map                         # → frontend/public/match-map
just word-assets::check                             # assert all artifacts exist
```

`vectors` needs the mono-lingual fastText Common Crawl files
(`cc.en.300.vec.gz`, `cc.es.300.vec.gz`, from
<https://fasttext.cc/docs/en/crawl-vectors.html>). `match-map` only needs the
pools plus spaCy/simplemma.

## The contract (kept in sync by hand)

This tool is deliberately standalone — no shared package — so a few small, stable
values are duplicated in the consumers and must be kept in sync. They live in
[`src/contract.py`](src/contract.py), each commented with its counterpart:

- Pool: `POOL_VERSION`, the `word_pool/{lang}.vN.npz` path, the npz keys, and the
  zipf threshold ↔ `backend/app/word_engine.py`.
- Match map: `MATCH_MAP_VERSION`, the `match-map/{lang}.vN.json` path, and
  `normalize_for_match` ↔ `frontend/lib/flowfic/match-map.ts` and `words.ts`.
- Quotes: `QUOTES_VERSION` and the `quotes/quotes.vN.jsonl` path ↔
  `frontend/lib/flowfic/quotes.ts`. Only the version + path shape are shared; the
  soft-wrap normalizer is build-only (the frontend renders pre-normalized blocks).

Bump a version here and in its counterpart when the format changes.

## Quote of the day

The landing dashboard shows a rotating literary "quote of the day". Unlike the
pool/match-map artifacts (large, generated, gitignored), the quotes file is
small, hand-curated content and **is committed**:

| Artifact | Written to | Consumed by |
| --- | --- | --- |
| Quotes `quotes.vN.jsonl` | `frontend/public/quotes/` | frontend (quote of the day) |

### Source corpus

Quotes are picked verbatim from the public-domain texts under
`nlp_literature_datasets/` (downloaded by [`download_datasets.py`](download_datasets.py)):

- `direct_requests/` — 4 books fetched as raw Project Gutenberg `.txt`. These
  keep real structure: paragraphs separated by blank lines, hard-wrapped at ~70
  columns. This is the only source that can yield **multi-line dialogue**.
- `hf_gutenberg/` — 100 books from the HuggingFace `gutenberg8k` mirror, whose
  text is **flattened** (all newlines stripped into one blob). Good for variety,
  but every quote from here is a single prose block.

The Hathitrust downloader (`download_hathi.py`) is unrelated — it fetches
aggregated word frequencies, not full text, so it is not a quote source.

### Storage format (JSON Lines, one quote per line)

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
  "text": { "en": ["block one", "block two"], "es": ["bloque uno", "bloque dos"] }
}
```

- `text` maps a language to an array of **paragraph blocks** (one element per
  line/turn; a dialogue exchange has several). Adding a language = adding a key.
- `origin` describes only `lang_source` (the verbatim original). `char_start` /
  `char_end` are offsets into a raw UTF-8 `read()` of `origin.file`, relative to
  `nlp_literature_datasets/`. `md5` is the md5 of that file's bytes.
- `kind` ∈ `statement` (single sentence), `prose` (multi-sentence single block or
  narration), `dialogue` (multi-block exchange with quotation marks). Recorded for
  future features; not shown in the UI.

The offsets point at the **raw** slice; the stored `text[lang_source]` is that
slice run through the soft-wrap normalizer (`normalize_quote` in
[`src/quotes.py`](src/quotes.py)): mid-paragraph wrap newlines collapse to
spaces, blank-line breaks become separate blocks. No word is ever changed.

### Curating and verifying

Curation is manual for now (no auto-picker). Given a source file, list candidate
paragraphs with exact offsets, preview, and heuristic `kind`:

```bash
just word-assets::slice-quotes "direct_requests/Lewis Carroll/Alice in Wonderland/content.txt"
# preview one exact slice as a JSON row (offsets you would record):
just word-assets::slice-quotes "<rel/path>" --start 13650 --end 13970
```

Copy good offsets into `frontend/public/quotes/quotes.vN.jsonl`, add
`id`/`author`/`source` and the translated `text` keys, then check integrity:

```bash
just word-assets::quotes-verify
```

`quotes-verify` re-reads each source (confirming its md5), re-slices by offsets,
re-normalizes, and asserts it equals the stored source-language blocks — so the
committed file can never silently drift from its sources. If a source is
re-downloaded and its md5 changes, verification fails until the offsets (and, if
the text moved, the `char_start`/`char_end`) are refreshed.
