# End-to-end tests (Playwright)

Browser tests for the journeys that the Vitest unit/component suite can't cover
— the ones that need real timers, real history, or a real round trip:

| Spec | Journey |
| --- | --- |
| `anonymous-game` | Welcome modal, start → type → quit → results, and the idle timeout firing on its own. |
| `full-game` / `required-word` | A required word spawns from the stubbed pool and is cleared by typing it. |
| `pause` | Pausing really freezes the timers, the editor stays readable but read-only, resume restores focus with the caret at the end, and quit's confirmation (skipped before the first keystroke). |
| `authenticated-save` | The signed-in save path: the POST contract, a player-supplied title, and the fallback to a derived one. |
| `stories` | My stories: the library count heading, and paging past the first 100 with "Load more". |
| `navigation` | History-API routing: `/new`, deep links, refresh, Back/Forward, mid-game Back, and logout. |
| `i18n` | Locale detection from `navigator.language`. |
| `backend-unreachable` / `dev-login` | The auth control's backend-driven visibility, and the dev-user backdoor. |

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
  request and answers it in-process. It records POST `/stories` bodies so a test
  can assert the request contract, and echoes the story back the way the real
  API does (title included) so a save can be followed into the stories list. It
  also *enforces* the settings contract, rejecting a drifted payload with a 422
  exactly as the backend would — so a frontend/backend settings mismatch fails
  the save journey here instead of passing silently. Keep its key list in sync
  with `GameSettings` and `StorySettingsStrict`.
- No real Auth0. `playwright.config.ts` starts the dev server with empty
  `NEXT_PUBLIC_AUTH0_*` vars, which forces the app's "unconfigured" auth shell
  (always anonymous, no external calls). Authenticated journeys use the dev-user
  backdoor, which is a pure-localStorage session — `seedDevSession` writes it
  before the page loads, so the app boots signed in with zero network.
- The landing's showcase opens on the **inspiration** face, so the recent
  stories (and their "Show all" link into `/stories`) are not on screen at load.
  Anything that asserts on them calls `openRecentStories` from `fixtures.ts`
  first, rather than each spec clicking the circle its own way.
- No flaky waits on timers. Timer-driven tests use Playwright's virtual clock
  (`page.clock`) to advance time instantly — which is also what lets the pause
  spec prove a frozen timer by fast-forwarding a minute past a 15-second idle
  deadline without the session ending. The required-word tests additionally pin
  the spawned word: they open "More options", type a word seed (which makes the
  engine fetch the related pool), drive the interval slider to its minimum, and
  stub `/words/related` to a single known word.

## Relationship to the Vitest suite

These run separately and never overlap: Vitest owns `tests/` (jsdom,
`vitest.config.ts`), Playwright owns `e2e/` (`testDir` in `playwright.config.ts`).
CI wiring is intentionally deferred — get them green locally first.
