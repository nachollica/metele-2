# FLOWFIC

This project is a web browser game about writing stories with speed. The game consists of a couple of timers and the "required words". The user must type and type, and if idle for long, game over!

## Project layout

- The game spans three code trees, each with its own `justfile`:
  - `@frontend/` — the Next.js game app (client-side only, static export).
  - `@backend/` — the FastAPI Python service (auth, persistence, word helpers).
  - `@word-assets/` — a small **standalone build-time tool** that generates the game's word data (see the Words section). Neither the backend nor the frontend depends on it at runtime.
- The admin panel lives under `@admin/` — a separate Vite + Refine + Ant Design SPA (English-only, no i18n), decoupled from the game app but following the same lint/type/test practices. Its API client is generated from the backend's OpenAPI spec via Orval (`just gen`); never hand-edit `admin/src/generated/`. See `admin/README.md` for the auth model and the add-a-new-resource guide.
- The repository root holds cross-cutting glue: the root `justfile` (which delegates into each project via `mod`, e.g. `just backend::test`; `just cc` runs checks across the projects), `docker-compose.yaml`, and the `prod/` Caddyfile bundle.
- The project uses `pnpm` instead of `npm` for the frontend.
- Always keep accessibility in consideration: check aria attributes, labels, and so on.
- The `@components/ui/` directory holds the app's own Radix UI + Tailwind primitives (originally scaffolded with the shadcn CLI, now hand-maintained); only the handful the app actually imports are kept, adapt them when the design calls for it. Pull in a fresh one with `npx shadcn@latest add <name>` (config in `frontend/components.json`) rather than hand-rolling a Radix wrapper from scratch.
- Ignore the `@.misc/` directory. Never browse or edit files there.

## Commit messages

Commit subjects start with one or more scope tags in square brackets, followed
by a short, plain description of the change:

```text
[scope] short description
[scope-a, scope-b] short description when the change spans areas
```

Conventions:

- No `feat`/`fix`/`chore`/etc. prefix. The wording already carries it: a fix
  reads like "fix …", a feature like "add … to …", docs like "update …". A bare
  verb after the tag is fine too, e.g. `[backend] refactor the word engine`.
- Prefer a single line. Add a body only when the change genuinely needs the
  context — a subtle rationale, a load-bearing decision, or several distinct
  threads — never to restate the diff.
- Do not add a `Co-Authored-By` trailer.

Scope tags — pick whichever best describe the change, combine with commas, and
introduce new ones as new areas appear:

- `backend` — the FastAPI service
- `frontend` — the Next.js game app
- `word-assets` — the build-time word/data tooling
- `admin` — the admin SPA
- `auth` — authentication (Auth0, login/account)
- `words` — the runtime related/random/match word logic
- `quotes` — the quote-of-the-day feature
- `inspiration` — the film-grab inspiration image feature
- `infra` — deployment and config (docker-compose, the prod Caddyfile, CI, root tooling)
- `docs` — READMEs and other docs, when that is the main change

Examples:

```text
[frontend] show a branded splash while the game chunk loads
[backend, frontend] move word matching to the client via a prebuilt match map
[word-assets, quotes] add quote-of-the-day curation and verification tooling
[infra] cache generated public/ data assets with a short must-revalidate policy
```

## Design decisions

- The game is entirely client-side rendered and served as pure static assets (Next.js static export). The backend is consulted only at the edges — auth, persistence, and the word helpers below — at session start, never per keystroke.
- It supports i18n. Two languages available for now: "en" and "es" (default). There are no per-language routes: the app is a single route, the locale is detected client-side from the browser and can be switched with the top-bar language selector (persisted per user in localStorage). When working on the UI make sure to add/edit any necessary entries in the translation files at `@frontend/lib/i18n/`.

## Words (related, random, matching)

Three concerns share one per-language data pipeline. All the heavy build-only tooling (fastText, wordfreq, simplemma, spaCy) lives **only** in `@word-assets/`; the backend and frontend runtimes carry none of it.

- **Related / random words** (backend). `POST /words/related` expands the player's "category" seed words into a loosely-themed pool; `POST /words/random` samples an unseeded pool. Both are called once at session start (the loading spinner covers them), never during play, and feed the required-word pool. They read a precomputed per-language fastText vector pool (`backend/data/word_pool/`); the runtime is numpy-only. Relatedness is deliberately loose — a seed only nudges the pool, so `dog` may pull in `cat` but `plane` is fine too. The pool is single-language by construction (wordfreq's frequency list intersected with the language's simplemma dictionary, which strips proper nouns, plus a cross-language frequency guard).
- **Word matching** (frontend, no backend endpoint). Whether a typed word satisfies the required word — the same word inflected counts (`gato`/`gatos`/`gata` yes, but distinct look-alikes like `palo`/`pala` no). The frontend loads a precomputed "match map" (`frontend/public/match-map/`, normalised surface form → inflection-group id) once at session start and decides every match locally, plus a small regular-plural rule. The map is derived from the same pool via simplemma + spaCy connected components.
- **The `@word-assets/` tool** builds both artifacts: `just word-assets::vectors --fasttext-dir ~/fasttext` (needs the mono-lingual fastText files), then `just word-assets::match-map`. The artifacts are large and **gitignored**, so a fresh checkout must regenerate them before building; the backend Docker build and the frontend `prebuild` step each fail loudly if their artifact is missing (`just check-assets` verifies all of them). A tiny contract (npz keys, artifact versions, the match normalizer) is duplicated across the tool, backend, and frontend and kept in sync by hand — see `word-assets/README.md`.

## Auth

- Authentication is Auth0-only, Google social login only. Facebook and X/Twitter were dropped from the login modal (the backend stays provider-agnostic — it validates any Auth0-issued token). There is no email + password flow — the only non-Auth0 path is the dev-user backdoor for local QA.
- The frontend Auth0 SPA flow uses `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_CLIENT_ID`, `NEXT_PUBLIC_AUTH0_AUDIENCE`. The backend only needs `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` because it validates RS256 tokens against the tenant's JWKS — no client secret on the server side.
- On first sign-in the backend hits Auth0's `/userinfo` and stores `name`, `picture`, and (best-effort) `email` on the local `User` row. Email is optional: providers that omit it leave the field NULL.
- The dev-user backdoor (`POST /auth/dev-login`) is gated by `DEV_USER_ENABLED`. It only authenticates pre-seeded usernames (created via `python -m app.scripts.seed_dev_user <username>`); it cannot create accounts. The settings validator refuses to enable it in production. The frontend learns whether it is enabled from `GET /ping` (`devUserEnabled`), so there is no frontend env flag for it.
- Admin access is claim-based and backend-authoritative: the Auth0 RBAC permission `manage:admin` (or `DEV_ADMIN_USERNAMES` for dev users, local only) makes `GET /auth/me` report `isAdmin: true`, which gates the game's "Admin panel" menu entry and the `admin/` SPA. All `/api/admin/*` routes answer 404 (never 401/403) to non-admins.
- `app.settings.Settings` runs a `model_validator` that refuses to construct an invalid production configuration (missing Auth0 creds, dev backdoor on, SQLite DB, localhost `FRONTEND_ORIGIN`, default `DEV_USER_TOKEN`, etc.). A misdeploy fails loud at boot rather than silently.

## Game flow

There is no left sidebar. The app is a single static route, but its stable screens are addressable by URL through client-side History API routing (see `frontend/components/flowfic/navigation.ts`): `/` landing, `/stories`, `/stories/:id`, `/journey` (the merged progress screen — formerly Statistics + Challenges + Achievements), `/profile`, and `/new` (the landing with its advanced-settings panel open). `dashboard.tsx` holds the visible screen as local state, seeds it from `window.location.pathname` on mount, pushes a history entry on each navigation, and listens for `popstate` so Back/Forward, refresh, and deep links all work; the transient game/loading/paused/ended states are engine-driven and own no URL. Mid-game, Back quits the session and stays in-app instead of leaving the document. The top bar holds only the brand logo (a home link), the account control, and the preferences (language / light-dark) — there is deliberately no game action there; the whole session lifecycle is driven from the home launcher and, mid-sprint, from the controls inside the game HUD. These are the screens:

- The landing screen (`landing.tsx`) is: the session launcher, a fixed-height panel that swaps between Recent stories and the advanced settings, and the inspiration card. A first-visit welcome/tutorial modal floats on top of it for anonymous users. Stats/weekly-summary are deliberately NOT on the landing; My Journey keeps its own screen, reached from the account menu (which also links My stories).
- The session launcher (`session-launcher.tsx`) is drawn on a 12:5 canvas: a square session dial (`timer-ring.tsx`, with the 5/10/15/25/45-minute picker inside it) spanning the two upper rows of column one, a 2x2 mode grid (`preset-grid.tsx`) filling columns two and three, and a bottom row of Start writing / More options / Custom modes. Below `md` the aspect lock is dropped and everything stacks. The grid holds the 3 system modes plus the highlighted challenge of the day, or — flipped by "Custom modes" — the user's 4 custom-mode slots. Mode cards *select*; the challenge card *starts the sprint immediately* (applying the classic profile, keeping the dialled length — the real challenge rules are still to come).
- "More options" swaps the panel below to `settings-panel.tsx` and pushes `/new`, so the open panel survives a refresh and Back closes it. Those rows never unmount when a master toggle is off — they grey out and disable — because the panel's height must stay stable inside its fixed-size container.
- "Show all" opens an expanded subsection (or Profile from the account menu, or a single story) as a detail screen with a back-arrow + title at the top of the main area (`detail-screen.tsx`).
- During a sprint the game area (`game-hud.tsx` + `writing-area.tsx`) fills the left of a desktop split. The HUD's leading square block carries the session controls that replaced the old top-bar action: Pause/Play over Quit, and — once the sprint ends — a single Finish button that performs the final checkout. Quit always asks first, and opening that confirmation pauses the sprint; cancelling leaves it paused rather than resuming a clock the player wasn't watching. Resuming re-arms every timer with the time it had left and returns focus to the editor with the caret at the end of the story. A required word is satisfied by any inflection of it (matching runs client-side; see the Words section).
- At the end the game shows a modal indicating game stats. Dismissing it leaves the finished text editable until the user finishes the story.

### Session settings

`GameSettings` (`frontend/lib/flowfic/types.ts`) is mirrored by `PresetSettings` / `StorySettings` in `backend/app/models.py` and by the key list in `frontend/e2e/fixtures.ts` — all four move together. Two things about it are easy to get wrong:

- The session timer is **always on**, so the settings carry only `globalTimerSeconds`, never an "enabled" companion. The idle timeout is the optional one (`idleTimerEnabled`, true in every system mode). `StorySettings` defaults `idleTimerEnabled` to true on read so rows written before it existed still validate.
- `globalTimerSeconds` is stored in a mode's JSON (picking a mode moves the dial) but is excluded from mode *matching* via `PRESET_MATCH_KEYS` — otherwise re-dialling the length would silently un-highlight the mode the player just chose.

### Inspiration

One shared "current inspiration" (`frontend/lib/flowfic/inspiration.ts`) — either a film still or a quote — backs both the home card and the in-game pane, so they always agree. It starts **unset**: the home card shows a magic-wand invitation, one click picks (a 50/50 coin flip between the two pools, then a random item from the chosen one), and clicking again re-rolls. The pick survives a reload via sessionStorage and is cleared by `finishAndReset`, i.e. the final checkout of a finished story. During a sprint it cannot be changed: the right pane renders a zoomable image or a static quote, is collapsible via the wand rail at its top, and does not render at all when nothing was picked. The wand icon means "inspiration" everywhere in the app.

### SPA routing, serving, and layout invariants

These are load-bearing and have each regressed before. Do not undo them without reading why.

- Serving the shell for every app path. Because routing is client-side over one exported `index.html`, the server must serve that shell for any addressable path (a refresh at `/stories` must not 404). Production does this with the Caddy SPA fallback (`try_files … /index.html` in `prod/conf/Caddyfile`); `next dev` has no Caddy, so `next.config.mjs` adds a dev-only catch-all rewrite to `/` (rewrites are unsupported under `output: "export"`, so they are attached only in the dev phase). Adding a new addressable screen means updating `navigation.ts` and nothing server-side.
- Auth redirects and the bfcache. Login/logout leave the SPA with a full-page redirect to Auth0. `loginWithProvider` replaces the current history entry (Auth0's `openUrl`) so the pre-login page is not duplicated below the returned session; the cross-origin `/authorize` entry itself cannot be removed from history, so the in-app history depth is what keeps Back inside the app. `components/bfcache-guard.tsx` reloads a page restored from the back/forward cache only when it was mid auth-redirect (`authRedirectState.inFlight`, an in-memory flag frozen into the heap). It must not reload on ordinary restores — in-app section navigation is same-document `popstate` and never triggers it, which is what preserves section state on Back.
- The "invisible footer" / document scroll lock (`app/globals.css`). The app shell is a fixed-height (`h-dvh`) column whose inner region is the only scroll container. BOTH `html` and `body` are pinned with `overflow: clip` (with `hidden` as the fallback) so portal/aux nodes appended to `<body>` cannot make the document scrollable and leave phantom empty space that overlaps the UI on the way back up — iOS Safari does not honour clipping the root alone, so `<body>` must be clipped too. Clipping `<body>` alone breaks Radix modals: react-remove-scroll injects a `margin-right` equal to `innerWidth - documentElement.clientWidth` to compensate for a scrollbar, and some mobile/zoom/emulation setups report those unequal, collapsing the layout. We keep the body clip and neutralise that compensation with a higher-specificity `html body[data-scroll-locked] { margin/padding-right: 0 !important }` rule (our document never shows a scrollbar, so there is nothing to compensate). Removing either half brings one of the two bugs back — do not drop the body clip to "fix modals".
- The same "invisible footer" has a second cause, one layer in: the html/body clip plus `overscroll-behavior: none` only stops an *inner* scrollable pane's overscroll from chaining into the document once the pane hits its scroll boundary. It does nothing about that pane's own native bounce/glow effect, which on iOS Safari (and some Android/emulated-touch setups) can visually overshoot past the pane's box before `scrollTop` reports it — rendering as the same blank strip below the content, then briefly misaligning real components on the way back. This reproduces on any element using a scrollable-overflow utility (`overflow-y-auto` etc — e.g. the game shell's main content pane in `dashboard.tsx`), not just the document root, so it is invisible to a plain mouse wheel and only shows up under touch or trackpad-elastic scrolling — which is why it was believed fixed on desktop and then resurfaced on mobile. Because any new scrollable pane can reintroduce it, the fix is a blanket rule in `app/globals.css` (`@layer base`) pinning `overscroll-behavior: contain` on every element matching Tailwind's `overflow-auto`/`overflow-y-auto`/`overflow-x-auto`/`overflow-scroll`/`overflow-y-scroll`/`overflow-x-scroll` utilities, app-wide — not a per-component `overscroll-*` class that each new scroll pane would have to remember to add. When testing for this bug, a plain mouse wheel is not enough — use touch emulation (or a real device) and scroll past both ends of a pane.
