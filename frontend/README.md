# Flowfic frontend

The Next.js client for Flowfic. All gameplay is client-side; the app is built
as a static export (`output: "export"`) and served as plain assets behind
Caddy in production. It talks to the FastAPI backend at `./backend/` only at
session start (word pools) and for saving/loading stories.

## Quickstart

```bash
pnpm install         # or: just frontend::init
cp .env.example .env.development.local   # then edit
pnpm dev             # or: just frontend::dev — http://localhost:3000
```

## Commands

```bash
just frontend::dev     # next dev
just frontend::build   # static export into out/
just frontend::cc      # all checks: eslint --fix, tsc --noEmit, vitest
just frontend::tc      # type-check only
just frontend::test    # vitest run
just frontend::e2e     # Playwright end-to-end suite (see e2e/README.md)
```

## Configuration

All variables are documented in [`.env.example`](.env.example) — read it there,
it is the single source of truth. The short version:

- Next.js loads `.env.development.local` for `next dev` and `.env.production`
  for `next build`. Do not use `.env.local` (it leaks into prod builds).
- Every `NEXT_PUBLIC_*` var is baked into the client bundle at build time, so
  none of them are secret.

## Auth

Social login only (Google, Facebook, X/Twitter), via the Auth0 SPA flow with
PKCE — there is no email/password path. When the three `NEXT_PUBLIC_AUTH0_*`
vars are unset the app renders an "unconfigured" shell that stays anonymous,
which is what the test suites use. A dev-user backdoor (gated by the backend's
`/ping` `devUserEnabled` flag) provides a localStorage-only session for local
QA without a real tenant.

## Internationalization

Two locales, `en` and `es`, with `es` as the default. Dictionaries live in
[`lib/i18n/`](lib/i18n/); `en.ts` is the canonical shape and `es.ts` must match
it (the `Translations` type enforces parity at compile time). Add or edit keys
in both files when touching UI strings.

## Project structure

| Path | What lives there |
| --- | --- |
| [`app/`](app/) | Next.js routes. The game tree is dynamically imported with `ssr: false`. |
| [`components/flowfic/`](components/flowfic/) | Game components (settings, HUD, writing area, results, profile). |
| [`components/auth/`](components/auth/) | Login modal, account button, dev-login. |
| [`components/ui/`](components/ui/) | In-house Radix UI + Tailwind primitives (originally scaffolded via the shadcn CLI); only the components actually used elsewhere are kept, adapt as needed. |
| [`lib/`](lib/) | Auth, backend-status, i18n, preferences, and the game logic + API clients under `lib/flowfic/`. |
| [`tests/`](tests/) | Vitest unit/component tests. |
| [`e2e/`](e2e/) | Playwright browser tests — see [e2e/README.md](e2e/README.md). |
