import { defineConfig, devices } from "@playwright/test"

// End-to-end (browser) tests. These live in ./e2e and are kept separate from
// the Vitest unit/component suite under ./tests so the two runners never pick
// up each other's files. Run with `pnpm test:e2e`.

const PORT = Number(process.env.E2E_PORT ?? 3000)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  // Each file's tests are independent; let them run in parallel.
  fullyParallel: true,
  // Fail the CI run if a `test.only` was committed by mistake.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    // Capture a trace only when retrying a failed test, so local runs stay fast
    // but CI failures are debuggable.
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Force the app into its "unconfigured" auth shell so the suite never
    // touches a real Auth0 tenant: with these three vars empty,
    // `readAuth0Config()` returns null and the app stays anonymous unless a
    // dev session is seeded (see e2e/fixtures.ts). Empty strings are set in
    // the spawned process env so `@next/env` won't override them from
    // `.env.development.local`.
    env: {
      NEXT_PUBLIC_AUTH0_DOMAIN: "",
      NEXT_PUBLIC_AUTH0_CLIENT_ID: "",
      NEXT_PUBLIC_AUTH0_AUDIENCE: "",
    },
  },
})
