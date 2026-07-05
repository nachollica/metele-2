# End-to-end tests (Playwright)

Browser tests for the journeys that the Vitest unit/component suite can't cover:
the real game loop in `flowfic-game.tsx` (timers firing, start → end → results),
locale detection, and the signed-in save-story path (POST contract + sidebar
refetch).

## Running

```bash
pnpm test:e2e        # headless, boots `next dev` automatically
pnpm test:e2e:ui     # interactive UI runner
# or: just frontend::e2e
```

Chromium is the only configured browser. Install it once with
`pnpm exec playwright install chromium` (CI will need this step too).

## How these tests stay deterministic and self-contained

- No real backend. `mockBackend` (in `fixtures.ts`) intercepts every `/api/**`
  request and answers it in-process. It also records POST `/stories` bodies so a
  test can assert the request contract.
- No real Auth0. `playwright.config.ts` starts the dev server with empty
  `NEXT_PUBLIC_AUTH0_*` vars, which forces the app's "unconfigured" auth shell
  (always anonymous, no external calls). Authenticated journeys use the dev-user
  backdoor, which is a pure-localStorage session — `seedDevSession` writes it
  before the page loads, so the app boots signed in with zero network.
- No flaky waits on timers. Timer-driven tests use Playwright's virtual clock
  (`page.clock`) to advance time instantly. The required-word test additionally
  pins the spawned word by enabling custom categories and stubbing the
  `/words/related` pool to a single known word.

## Relationship to the Vitest suite

These run separately and never overlap: Vitest owns `tests/` (jsdom,
`vitest.config.ts`), Playwright owns `e2e/` (`testDir` in `playwright.config.ts`).
CI wiring is intentionally deferred — get them green locally first.
