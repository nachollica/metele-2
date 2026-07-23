import { type Page } from "@playwright/test"

// Shared helpers for the e2e suite. These deliberately avoid any real network
// or real Auth0: the backend is stubbed at the route layer (`mockBackend`) and
// authenticated journeys are driven through the dev-user backdoor, which is a
// pure-localStorage session (see lib/auth/dev.ts) and so needs no Auth0 tenant.

// ---- localStorage keys (mirror the app) ---------------------------------
// Keep these in sync with the constants in the app:
//   - dashboard.tsx             -> WELCOME_STORAGE_KEY
//   - lib/auth/dev.ts           -> TOKEN_KEY / USER_KEY
const WELCOME_DISMISSED_KEY = "flowfic.welcome.dismissed"
const DEV_TOKEN_KEY = "flowfic.dev.token"
const DEV_USER_KEY = "flowfic.dev.user"

export const DEV_TOKEN = "e2e-dev-token"

// Matches the `AuthUser` shape returned by GET /auth/me.
export const DEV_USER = {
  id: "dev|e2e",
  email: "e2e@flowfic.test",
  name: "E2E Dev User",
  avatarUrl: null,
  customPresets: [] as unknown[],
}

// Server (wire) shape of a Story, as the backend returns it (snake_case).
export type StoryWire = {
  id: number
  text: string
  lang: string
  created_at: string
  user_id: string | null
  settings: Record<string, unknown>
  stats: Record<string, unknown>
}

// Pre-set the "welcome dismissed" flag so the first-visit tutorial modal
// doesn't cover the settings screen. Must be called BEFORE `page.goto`.
export async function dismissWelcomeBeforeLoad(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key as string, "1")
  }, WELCOME_DISMISSED_KEY)
}

// Seed a dev-user session into localStorage so the app boots authenticated
// (status === "authenticated") without any Auth0 round-trip. Must be called
// BEFORE `page.goto`.
export async function seedDevSession(
  page: Page,
  user: typeof DEV_USER = DEV_USER,
  token: string = DEV_TOKEN,
): Promise<void> {
  await page.addInitScript(
    (args) => {
      const a = args as { tokenKey: string; userKey: string; token: string; user: unknown }
      window.localStorage.setItem(a.tokenKey, a.token)
      window.localStorage.setItem(a.userKey, JSON.stringify(a.user))
    },
    { tokenKey: DEV_TOKEN_KEY, userKey: DEV_USER_KEY, token, user },
  )
}

// Handle returned by `mockBackend` so a test can assert on what the frontend
// sent and control what subsequent reads return.
export type BackendMock = {
  /** Bodies of every POST /stories the frontend made, in order. */
  postedStories: Array<Record<string, unknown>>
  /** Current server-side story list (newest first), as wire objects. */
  stories: StoryWire[]
}

// Intercept all backend (`/api/**`) traffic and answer it in-process. Returns
// a live handle whose `postedStories` array is appended to as the frontend
// POSTs, and whose `stories` list grows so a follow-up GET reflects the save.
//
// Any `/api/**` route not explicitly handled returns an empty 200 — enough for
// opportunistic calls like POST /words/related (the game falls back to its
// hardcoded pool when the response carries no usable words).
export async function mockBackend(
  page: Page,
  options: {
    initialStories?: StoryWire[]
    relatedWords?: string[]
    // When false, GET /ping is aborted so the app sees the backend as
    // unreachable (the header auth control then hides). Defaults to reachable.
    pingReachable?: boolean
  } = {},
): Promise<BackendMock> {
  const handle: BackendMock = {
    postedStories: [],
    stories: [...(options.initialStories ?? [])],
  }

  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname.replace(/^\/api/, "")

    // Liveness probe. The header reads this to decide whether to show the
    // auth control and the dev-login shortcut.
    if (path === "/ping" && method === "GET") {
      if (options.pingReachable === false) {
        await route.abort("failed")
      } else {
        await route.fulfill({
          json: {
            status: "ok",
            version: "test",
            environment: "testing",
            devUserEnabled: true,
            utcStartedAt: new Date().toISOString(),
          },
        })
      }
      return
    }

    if (path === "/auth/me" && method === "GET") {
      await route.fulfill({ json: DEV_USER })
      return
    }

    // Dev-user backdoor: mirror the backend's DevLoginResponse shape so the
    // header's DevLoginButton can drive a session without a real backend.
    if (path === "/auth/dev-login" && method === "POST") {
      await route.fulfill({ json: { token: DEV_TOKEN, user: DEV_USER } })
      return
    }

    if (path === "/stories" && method === "GET") {
      await route.fulfill({
        json: {
          items: handle.stories,
          total: handle.stories.length,
          limit: 50,
          offset: 0,
        },
      })
      return
    }

    // Gamification endpoints — the dashboard fetches these for signed-in users.
    // Zeros + empty lists are enough to render every card; the individual specs
    // don't assert on the numbers.
    if (path === "/stats/overview" && method === "GET") {
      await route.fulfill({
        json: {
          streak: 0,
          totalSessions: 0,
          totalWords: 0,
          totalDurationMs: 0,
          level: { level: 1, totalXp: 0, xpIntoLevel: 0, xpForLevel: 300 },
          weekly: {
            sessions: 0,
            words: 0,
            durationMs: 0,
            deltaSessions: null,
            deltaWords: null,
            deltaDurationMs: null,
          },
          chart: [],
        },
      })
      return
    }

    if (
      (path === "/stats/achievements" || path === "/stats/challenges") &&
      method === "GET"
    ) {
      await route.fulfill({ json: [] })
      return
    }

    if (path === "/stories" && method === "POST") {
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>
      handle.postedStories.push(body)
      const created: StoryWire = {
        id: handle.stories.length + 1,
        text: String(body.text ?? ""),
        lang: String(body.lang ?? "en"),
        created_at: new Date().toISOString(),
        user_id: DEV_USER.id,
        settings: (body.settings as Record<string, unknown>) ?? {},
        stats: (body.stats as Record<string, unknown>) ?? {},
      }
      handle.stories.unshift(created)
      await route.fulfill({ status: 201, json: created })
      return
    }

    // Custom required-word pool. When a test supplies `relatedWords`, the game
    // draws every required word from it — making the spawned word deterministic.
    if (path === "/words/related" && method === "POST") {
      await route.fulfill({
        json: { language: "en", words: options.relatedWords ?? [] },
      })
      return
    }

    // Anything else (e.g. /profile/me/presets): benign empty 200.
    await route.fulfill({ status: 200, json: {} })
  })

  return handle
}
