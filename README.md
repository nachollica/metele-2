# Flowfic

A browser game about writing stories under time pressure. A session timer and a
stream of "required words" keep you typing — stay idle too long and it's game
over. Sessions can be saved to your account and read back later.

You start from the home screen: dial a length (5–45 minutes), pick a game mode,
and hit Start writing. Optionally take an "inspiration" first — a film still or
a literary quote — and it stays beside you for the whole sprint. Mid-sprint you
can pause or quit; when the timer runs out you get your stats, then the story
stays editable so you can polish and name it before saving.

## Layout

| Path | What lives there |
| --- | --- |
| [`frontend/`](frontend/) | Next.js app (static export). Game UI, Auth0 SPA flow, i18n, client-side word matching. See [frontend/README.md](frontend/README.md). |
| [`backend/`](backend/) | FastAPI service. Auth0 token validation, profile/preset/story APIs, and the related/random word helpers. See [backend/README.md](backend/README.md). |
| [`word-assets/`](word-assets/) | Standalone build-time tool that generates the per-language word data (vector pools + match maps) consumed by the backend and frontend. See [word-assets/README.md](word-assets/README.md). |
| [`prod/`](prod/) | Production deployment bundle: Caddy reverse proxy, Postgres, and the API in `docker-compose.yaml`. |
| `justfile`, `docker-compose.yaml` | Cross-cutting glue only. Per-project commands live in each subdirectory's `justfile`. |

The game is fully client-side and ships as static assets; the backend is
consulted only at session start (word pools) and for saving/loading stories,
while word matching runs entirely in the browser. The word data the game relies
on is built by `word-assets/` and is **gitignored** — regenerate it before
building (both builds fail loudly if it is missing). See its README.

## Quickstart

Requires [`just`](https://github.com/casey/just), Docker, [`uv`](https://docs.astral.sh/uv/)
(backend), and [`pnpm`](https://pnpm.io/) (frontend).

```bash
just dev          # dockerized API (compose) + frontend dev server on :3000
```

Or run the pieces directly:

```bash
just frontend::dev   # next dev
just backend::dev    # uvicorn on :8000 (loads backend/.env)
```

## Common commands

```bash
just help            # list root commands
just help-all        # include backend:: / frontend:: subcommands
just cc              # run all checks (lint + types + tests) across all projects
just check-assets    # verify the generated word data is present
just up / down / logs   # full docker stack (caddy + api + db)
```

## Configuration

Each project reads its own environment. Every variable is documented once, in
the matching example file — copy it and edit:

- Backend: [`backend/.env.example`](backend/.env.example) → `backend/.env`
- Frontend: [`frontend/.env.example`](frontend/.env.example) → `frontend/.env.development.local`

## Deployment

The `prod/` bundle is shipped to an SSH host and run with Docker Compose
(Caddy terminates TLS in front of the API and serves the static frontend;
Postgres backs the data). See the `[group("deploy")]` recipes:

```bash
just deploy          # build + ship backend image and frontend assets, restart
```

Auth, the dev-user backdoor, and the production guardrails are described in
[backend/README.md](backend/README.md).
