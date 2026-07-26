# word-assets

Build-time generator for FLOWFIC's word artifacts. It is a standalone `uv`
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

Bump a version here and in its counterpart when the format changes.
