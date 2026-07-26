# FLOWFIC backend

FastAPI service handling Auth0-backed user identity (social login only),
per-user profile state (presets, etc.), the game's word helpers (related /
random / match, served from precomputed per-language artifacts), and
persistence for finished stories. Pairs with the Next.js frontend at
`./frontend/`.

## Quickstart

```bash
cd backend
uv sync
cp .env.example .env   # then edit as needed
just dev               # loads .env into the shell, runs uvicorn on :8000
```

Settings come only from the environment — nothing reads `.env` at runtime, so
`just dev` sources it into the shell first. Every setting without a sensible
default is mandatory and fails loudly at boot if unset. SQLite is for
local/test; production points `DATABASE_URL` at Postgres — see
[Database](#database).

The frontend talks to the API via `NEXT_PUBLIC_API_URL` (same origin in dev).

## Authentication

Real users authenticate exclusively through Auth0's hosted social-login
flow (Google, Facebook, X/Twitter). The backend validates the Auth0-issued
RS256 access tokens against the tenant's JWKS — no email/password endpoint
exists. The first time we see a given `sub`, we hit Auth0's `/userinfo` to
populate the local `User` row's `name`, `picture`, and `email`. The
`email` field is best-effort: providers that omit it (older Twitter
configurations, some custom OIDC) simply leave it `NULL` on the row, and
the user can fill it in later via `PATCH /profile/me`.

For manual QA without a real Auth0 tenant there is a dev-user backdoor —
see [Dev-user backdoor](#dev-user-backdoor) below.

## Environment

Every variable is documented inline in [`.env.example`](.env.example) — copy
it to `.env` and edit. The `app.settings.Settings` model enforces these
environment-specific guardrails at construction; failing any stops the app from
booting (the desired loud-failure mode for a misdeploy):

| Env | Auth0 | Dev backdoor | DB | FRONTEND_ORIGIN | Deliverability |
| --- | --- | --- | --- | --- | --- |
| `local` / `development` / `testing` | optional | allowed | any | any | optional |
| `production` | required | refused | Postgres only | non-localhost | forced on |

The frontend Auth0 SPA client ID lives only in the frontend env
(`NEXT_PUBLIC_AUTH0_CLIENT_ID`) — the backend never needs it: JWKS validation
is independent of the client, and there is no client secret on the server.

## Endpoints

### Auth (`/auth`)

| Route | Description |
| --- | --- |
| `GET /auth/me` | Returns the current user — `Authorization: Bearer <token>`. |
| `POST /auth/dev-login` | Mint a dev-user token by username. Disabled in prod. |

### Profile (`/profile`)

Per-user state that isn't part of identity verification. All endpoints
require auth.

| Route | Description |
| --- | --- |
| `GET /profile/me` | Same shape as `/auth/me`; here for symmetry with PATCH. |
| `PATCH /profile/me` | Partial update: name / email / picture. |
| `POST /profile/me/presets` | Add a custom session preset (max 5). |
| `PATCH /profile/me/presets/{id}` | Rename and/or replace a preset's settings. |
| `DELETE /profile/me/presets/{id}` | Remove one preset. |

### Stories (`/stories`)

| Route | Description |
| --- | --- |
| `GET /stories` | Paginated list of the caller's stories. |
| `GET /stories/count` | Total count for the caller. |
| `GET /stories/{id}` | Fetch one of the caller's stories by id. |
| `POST /stories` | Create a story (optional `title`; full `settings` and `stats` objects, validated). |
| `DELETE /stories/{id}` | Hard delete. |

Ops note: databases created before the AI-illustration feature was removed
(it never shipped an endpoint) may still contain an empty `story_images`
table. It is unused and safe to drop manually
(`DROP TABLE IF EXISTS story_images;`) whenever convenient.

### Words (`/words`)

| Route | Description |
| --- | --- |
| `POST /words/related` | Expand seed words into a loosely-themed game word pool. |
| `POST /words/random` | Sample an unseeded random pool (used when required words are on but no categories are given). |

Both require auth. Body for `/words/related`:
`{ "words": ["animal"], "language": "en", "limit": 300 }` (`limit` caps at
2000). `/words/random` takes `{ "language": "en", "limit": 300 }`.

Language resolution is the same for both:

1. Explicit `language` field in the body.
2. `Accept-Language` header (q-values respected).
3. Otherwise → **400**.

Both are served from a precomputed, per-language, single-language artifact baked
under `data/` — no model runs at request time. `app.word_engine` reads
`data/word_pool/{lang}.npz`: the language's clean word pool plus mono-lingual
fastText vectors. The pool is wordfreq's frequency list intersected with that
language's simplemma dictionary (strips proper nouns like `john`/`juan`) and a
frequency guard against loanwords, which keeps it single-language. `related`
takes each seed's nearest neighbours and deliberately dilutes them with random
pool words (tight relatedness is not a goal — a seed only nudges the pool), so
`dog` may pull in `cat` but `plane` is fine too.

**Word matching runs entirely in the frontend** (does a typed word satisfy the
required word — `gatos`/`gato` yes, `palo`/`pala` no). `app.scripts.build_match_map`
turns the same pool into `frontend/public/match-map/{lang}.vN.json` (normalised
surface → inflection-group id, via simplemma + spaCy connected components); the
frontend loads it once and matches locally, with a small regular-plural rule for
the rest. There is no backend match endpoint.

Regenerating the artifacts (after a vocabulary/tuning change) needs the
build-only dependency group; the vector pool also needs the mono-lingual
fastText files:

```bash
uv sync --group build   # or: just init
just vectors --fasttext-dir ~/fasttext   # cc.en.300.vec.gz, cc.es.300.vec.gz
just match-map                            # → frontend/public/match-map/*.json
```

### Meta

| Route | Description |
| --- | --- |
| `GET /ping` | Unauthenticated liveness + metadata (version, environment, `devUserEnabled`). |
| `GET /ping/db` | Auth-gated DB health check — confirms a trivial query, returns dialect + latency. |

## Dev-user backdoor

`POST /auth/dev-login` accepts `{ "username": "alice" }` and returns a
shared-secret token of the shape `<DEV_USER_TOKEN>:<username>`. The auth
dependency recognises that prefix and resolves it to the matching
pre-seeded `User` row, skipping JWKS verification entirely.

The backdoor **cannot create accounts** — only rows that already exist in
the `users` table authenticate. Seed them via:

```bash
uv run python -m app.scripts.seed_dev_user alice bob carol
```

Production refuses to enable this feature: `Settings` rejects
`DEV_USER_ENABLED=true` when `ENVIRONMENT=production`.

## Database

Backends live as siblings inside `app/db/`:

- `app/db/sqlite.py` — local-dev SQLite engine. Sets `check_same_thread=False`.
- `app/db/postgres.py` — production Postgres engine (psycopg v3, pre-ping,
  pool). Normalises `postgres://` and `postgresql://` URLs to the psycopg
  driver automatically.
- `app/db/migrations.py` — the additive `ALTER TABLE` migration shim both
  backends run on startup. One registry of (table, column, per-dialect DDL);
  anything beyond ADD COLUMN waits for a real migration tool (Alembic).

`app/db/__init__.py` picks the right backend from `DATABASE_URL` and
re-exports `engine` / `init_db` / `get_db` so route modules stay agnostic.
Production deploys point `DATABASE_URL` at Postgres; tests stay on SQLite.

### Running in Docker

The repo-root `docker-compose.yaml` runs just this service on SQLite (a named
`flowfic-data` volume holds the file — `DATABASE_URL` is the only place the
location is set):

```bash
docker compose up --build api
```

The production bundle in `prod/docker-compose.yaml` adds Postgres 16-alpine
(with a `pg_isready` healthcheck the API waits on) and Caddy, and disables the
`/docs` page via `ENVIRONMENT=production`.

## Code conventions

A few backend-wide conventions, explained here once so they aren't re-litigated
inline:

- **camelCase wire fields.** Some models cross the wire to (or are stored as
  JSON for) the frontend and mirror its keys 1:1 — the full `GameSettings`
  snapshot on a story, the preset settings, `AuthUser.avatarUrl`, the
  `/ping` payload, etc. Those fields keep their camelCase names with an inline
  `# noqa: N815` rather than relying on Pydantic aliases, so the wire shape is
  explicit at the field and there is no hidden snake_case↔camelCase translation.
  The one place we do translate (`User.picture` → `avatarUrl`) is an explicit
  `AuthUser.from_user(...)` constructor, not an alias.
- **Model construction.** Build models with explicit keyword constructors
  (e.g. `AuthUser.from_user(...)`, `Settings(environment=..., ...)`) so mypy
  checks each field. The one sanctioned use of `model_validate` is reading an
  ORM row into a response model via `from_attributes` (e.g.
  `StoryRead.model_validate(row)` in `app/routes/stories.py`), where the source
  is a typed SQLModel row, not untrusted input.
- **Docstrings.** Multi-line docstrings put the opening and closing `"""` on
  their own lines, with the summary starting on the second line. The opening
  half is enforced for `app/` by Ruff's `D213`; the closing-quote-on-its-own-line
  and "leave one-line docstrings on one line" parts are conventions the linter
  doesn't police.
- **Multi-line strings.** When a string literal spans lines, wrap it in
  parentheses and let the fragments implicitly concatenate, one per line:

  ```python
  detail=(
      "Could not determine language. Provide it via the request "
      "body `language` field or the `Accept-Language` header."
  )
  ```

  Ruff can't distinguish this from the un-parenthesized form, so it's applied
  by hand.

## Tests

```bash
uv run pytest
```

Tests run against SQLite — each case gets its own temp DB. Auth0 calls are
mocked with `respx`; the dev-login backdoor is exercised end-to-end against
the real `get_current_user` dependency. `test_settings.py` covers the
production guardrails so a regression in the validator fails CI before it
fails a deploy.
