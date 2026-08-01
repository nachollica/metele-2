import path from "node:path"

import { defineConfig, devices } from "@playwright/test"

// Real-backend integration lane. Unlike the mocked suite in ./e2e, these specs
// run the browser against an actual FastAPI app + SQLite DB and assert on
// persisted state (through the API and via a raw DB read).
//
// It runs on its own ports and a throwaway DB so it never collides with a
// developer's local backend on :8000 / frontend on :3000. Both servers always
// boot fresh (no reuse) so each run starts from an empty database.
//
// Playwright loads this config as CommonJS (no "type": "module"), so we can't
// use import.meta — the lane is always invoked from the frontend dir, so paths
// are resolved from process.cwd().
const BACKEND_DIR = path.resolve(process.cwd(), "..", "backend")

const FRONTEND_PORT = 3100
const BACKEND_PORT = 8001
const BASE_URL = `http://localhost:${FRONTEND_PORT}`
const API_URL = `http://localhost:${BACKEND_PORT}`

export default defineConfig({
  testDir: "./e2e-integration",
  // One shared backend + SQLite file: run serially to avoid concurrent-writer
  // contention and to keep persistence assertions deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Isolated backend: fresh SQLite DB under backend/.e2e, dev-login enabled,
      // and an 'e2e' user seeded (see `just e2e-serve`).
      command: "just e2e-serve",
      cwd: BACKEND_DIR,
      url: `${API_URL}/api/ping`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Build the static export and serve it — Next 16 forbids a second dev
      // server per project (the mocked lane may hold one), and serving the
      // build is closer to production anyway. Requires no `next dev` for this
      // project to be running concurrently (it would share .next).
      command: `pnpm build && node e2e-integration/serve.mjs ${FRONTEND_PORT}`,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        // Point the app at the isolated backend; keep Auth0 empty so the only
        // auth path is the dev-login backdoor.
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_PUBLIC_AUTH0_DOMAIN: "",
        NEXT_PUBLIC_AUTH0_CLIENT_ID: "",
        NEXT_PUBLIC_AUTH0_AUDIENCE: "",
      },
    },
  ],
})
