# Frontend revamp — session summary

> **Historical.** This records one past session and is no longer an accurate
> description of the app. The home screen has since been rebuilt around a
> session launcher, the top-bar game button is gone, and the inspiration feature
> covers quotes as well as film stills. For how the game actually works today
> see [CLAUDE.md](CLAUDE.md) ("Game flow") and
> [frontend/README.md](frontend/README.md). Kept only as a record of how the
> layout got here; safe to delete.

A consolidated description of the state after that session's work. It describes
the result, not the intermediate iterations.

## Overview

The game moved from a left-sidebar layout to a full-width, single-route app with
a top bar and a client-side "screen" state machine. A landing dashboard now
aggregates everything; expanded subsections open as detail screens. A new
inspiration-image feature (placeholder for now) sits beside the game. The
authenticated experience against the real Auth0 tenant was fixed at the backend
config level.

Everything below is covered by the test suite: lint, typecheck, 195 unit tests,
and 10 Playwright e2e tests all pass.

## Navigation and layout

- No left sidebar. Navigation is local screen state in
  `frontend/components/flowfic/dashboard.tsx` (the app is a single route). Screens:
  landing, configuring, section detail, profile, single-story view; engine states
  (loading / playing / ended) take precedence and render the game.
- The landing dashboard (`landing.tsx`) aggregates the former Home content plus
  the previously sidebar-navigated sections.
- Expanded subsections (Statistics, Achievements, Challenges, My stories),
  Profile, and single-story view use one shared chrome — `detail-screen.tsx` —
  a back-arrow plus title at the top of the main area, in a centered
  `max-w-5xl` container. Profile fills the same width as the others (no more
  misaligned back arrow).
- Non-game screens use the centered container; the configuring and playing
  screens use a desktop split (see below). On mobile everything is a single
  column.

## Top bar

Left to right:

- Brand logo (doubles as a home link; full logo on desktop, icon on mobile).
- Language dropdown and light/dark toggle, sitting next to the logo.
- On the far right: the dev-login shortcut (when enabled), the account control
  (Log in / avatar menu), and the primary game button anchored rightmost.

Controls and behavior:

- All top-bar controls share one look: the shared `Button` component, outline
  variant, `rounded-md`, height `h-10`. The two real calls to action (game
  button, Log in) keep the prominent green.
- Language: languages icon on mobile; icon plus the selected language name from
  `md` up. The menu lists full names with a check on the current one.
- Theme: a sun/moon toggle reflecting the active theme; icon-only on mobile,
  icon plus label from `md` up.
- Account: avatar plus name (name from `sm` up); the dropdown shows the user's
  name, email, and an amber Trophy "Level" badge beside them (not below),
  followed by Profile and Log out.
- Dev-login is a plain outline icon button (no dashed border). Login visibility
  is backend-driven: hidden when the backend is unreachable, shown when
  reachable, plus the dev-login button only when the backend reports the dev
  backdoor enabled.
- Language and account menus are non-modal, which avoids a mobile layout
  collapse caused by the modal scroll-lock.

### Primary game button states

One button cycles through the game lifecycle:

- Create a story (sparkles) — from the landing/detail screens; opens the
  session configurator.
- Start writing (pencil) — on the configuring screen; begins the sprint.
- Quit session (cross) — while playing.
- Back to home (house) — after a sprint ends and the text is still editable;
  saves and returns to the landing.

Label responsiveness follows a priority order: the game button keeps a label at
every size (short forms on mobile: Create / Write / Quit / Home), Log in drops
to an icon on mobile, and language/theme labels appear only from `md`. The full
phrases remain the accessible names at all sizes.

## Landing dashboard

Order and sizing:

- Inspiration image, full container width.
- Prompt of the day and Weekly summary — half width each, stacking on mobile.
- Statistics — full width: Level and days-in-a-row badges on the left, the
  weekly timeline on the right.
- Achievements and Challenges — half width each (stack on mobile). Achievements
  shows three compact items; Challenges shows one fixed featured challenge
  (`daily_600`, falling back to the first available).
- Recent stories — full width.

Each subsection card has a soft, ghost-styled "Show all" button that opens the
full detail screen. It is disabled for anonymous users (the detail screens need
an account). Achievements/Challenges/Stories show the sign-in prompt only to
anonymous users; a signed-in user with not-yet-loaded data renders empty rather
than the prompt.

## Game / setup screen (desktop split)

- Two columns: left is the settings panel or the game area (~7/12), right is the
  inspiration image (~5/12). On mobile the image pane is hidden and the screen
  shows one thing at a time.
- The image pane is zoomable and pannable with the mouse:
  - Minimum zoom is the image fit to width (fully visible, edge to edge).
  - Vertical wheel zooms in up to where the image fills the pane height (a
    landscape image crops the sides).
  - Once zoomed, a horizontal wheel (or shift+wheel) and click-and-drag pan
    left/right to reveal the cropped edges; panning is clamped to the image.

The inspiration image is a placeholder (a landscape remote URL) until the real
per-session image feature lands.

## Accessibility

- Every screen has a heading: detail screens carry the title as an `h1`; the
  landing has a visually-hidden `h1` (it has no visible title by design).
- Icon-only controls carry `aria-label`s; decorative images use empty alt text;
  the zoomable image exposes `role="img"` with a label.
- The document is pinned (`html` clip) so the page can't rubber-band into
  phantom empty space; the inner region is the only scroll container.

## Internationalization

- English and Spanish stay in shape-sync (`frontend/lib/i18n/en.ts` is the
  canonical dictionary; `es.ts` mirrors it).
- Short game-button labels are sibling keys with a `Short` suffix
  (`nav.newStoryShort`, `settings.startShort`, `game.quitShort`,
  `nav.backToHomeShort`), shown on mobile; the full versions are used on larger
  screens and as accessible names.

## Backend / Auth (local)

- Real Auth0 social login (e.g. Google) validates locally again. The committed
  `docker-compose.yaml` ships empty Auth0 settings (dev-backdoor only); the real
  tenant is supplied by a git-ignored `docker-compose.override.yaml`
  (`AUTH0_DOMAIN` / `AUTH0_AUDIENCE`) that must match
  `frontend/.env.development.local`. Without it, authenticated endpoints answer
  503 and the UI can't load a signed-in user's data.
- The dev-user backdoor still requires a seeded user
  (`python -m app.scripts.seed_dev_user <name>` inside the api container).

## Code quality

- Header/nav controls are unified on the shared `Button` variants (square with
  radius, consistent hover and colors); back-arrow and "Show all" stay soft
  ghost while other controls are outline.
- Shared widgets in `dashboard-widgets.tsx`: `StatTile`, `SectionHeader`,
  `ShowAllButton`, `LevelBadge`, and `EmptyHint` (one place for the muted,
  centered empty / sign-in states that were repeated across sections).
- Removed an orphaned i18n key (`game.createStory`).

## Verification

Run from `frontend/`:

- `just cc` — fix, typecheck, unit tests.
- `just e2e` — Playwright suite (auto-boots the dev server; stubs the backend).
