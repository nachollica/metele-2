# METELE backend

FastAPI service that handles user auth (Google / Instagram / Facebook OAuth)
and a small WordNet-backed helper for the game's word pool. Pairs with the
Next.js frontend at the project root.

## Quickstart

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

The server boots on `http://localhost:8000`. The frontend talks to it via
`NEXT_PUBLIC_AUTH_API_URL` (defaults to that same origin in dev).

## Environment

Copy `.env.example` → `.env` and fill in the OAuth credentials you want to
exercise. Anything you skip simply makes the corresponding *real* login route
return 503 — the mock variants always work.

| Var | Purpose |
| --- | --- |
| `FRONTEND_ORIGIN` | Used for CORS + `return_to` allow-listing. |
| `BACKEND_ORIGIN` | The redirect URI registered with each provider. |
| `JWT_SECRET` | Signs session JWTs and OAuth `state`. Rotate to force re-login. |
| `<PROVIDER>_CLIENT_ID/SECRET` | OAuth credentials per provider. |

## Endpoints

| Route | Description |
| --- | --- |
| `GET /auth/{provider}/login?return_to=...` | Redirects to provider consent screen. |
| `GET /auth/mock/{provider}/login?return_to=...` | Same shape but skips the provider — handy for end-to-end tests. |
| `GET /auth/{provider}/callback` | Exchanges the auth code, mints a session JWT, redirects to `return_to#token=...&user=...`. |
| `GET /auth/me` | Returns the current user — `Authorization: Bearer <jwt>`. |
| `POST /auth/logout` | No-op for stateless JWTs (token wipe is client-side). 204. |
| `POST /words/related` | Expands "category" words into related words via WordNet hyponyms (EN/ES). |
| `GET /health` | Liveness probe. |

`{provider}` ∈ `google`, `instagram`, `facebook`.

### `POST /words/related`

Body: `{ "words": ["animal"], "language": "en", "depth": 2, "limit": 100 }`.

`language` is optional. Resolution order:

1. Explicit `language` field in the body.
2. `Accept-Language` header (q-values respected, first supported tag wins).
3. Otherwise → **400**. The server never silently defaults to English.

Supported languages: `en`, `es`. Backed by [NLTK WordNet](https://www.nltk.org/howto/wordnet.html)
plus the Open Multilingual WordNet for Spanish lemmas. The first request
bootstraps the corpora into NLTK's data dir; subsequent calls are local
lookups.

## Tests

```bash
uv run pytest
```

Uses `respx` to mock the providers' HTTP calls — no network required. The
mock-flow tests double as the integration check that the route plumbing works
end-to-end.
