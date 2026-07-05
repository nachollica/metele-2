# FLOWFIC

A browser game about writing stories under time pressure. Two timers and a
stream of "required words" keep you typing — stay idle too long and it's game
over. Sessions can be saved to your account and replayed later.

## Layout

| Path | What lives there |
| --- | --- |
| [`frontend/`](frontend/) | Next.js app (static export). Game UI, Auth0 SPA flow, i18n. See [frontend/README.md](frontend/README.md). |
| [`backend/`](backend/) | FastAPI service. Auth0 token validation, profile/preset/story APIs, WordNet word helpers. See [backend/README.md](backend/README.md). |
| [`prod/`](prod/) | Production deployment bundle: Caddy reverse proxy, Postgres, and the API in `docker-compose.yaml`. |
| `justfile`, `docker-compose.yaml` | Cross-cutting glue only. Per-project commands live in each subdirectory's `justfile`. |

The game is fully client-side and ships as static assets; the backend is
consulted only at session start (word pools) and for saving/loading stories.

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
just cc              # run all checks (lint + types + tests) for both projects
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
