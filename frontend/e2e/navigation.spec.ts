import { expect, test } from "@playwright/test"

import {
  dismissWelcomeBeforeLoad,
  mockBackend,
  seedDevSession,
  type StoryWire,
} from "./fixtures"

// URL-driven navigation: the app is a single static route, but its stable
// screens are addressable by path via the History API (see
// components/flowfic/navigation.ts). These assert that Back/Forward, refresh,
// and deep links behave — the bug class this suite guards against is the app
// only having in-memory screen state with no history to step through. In
// `next dev` the dev-only rewrite serves the shell for these paths (prod does
// this via Caddy).

test("the header action pushes /new; browser Back returns to the landing", async ({
  page,
}) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")
  await expect(page).toHaveURL("/")

  await page.getByRole("button", { name: "Create a story" }).click()
  await expect(page).toHaveURL("/new")
  await expect(page.getByRole("button", { name: "Start writing" })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("button", { name: "Create a story" })).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL("/new")
})

test("a deep link + refresh at /stories renders the section (no 404, stays put)", async ({
  page,
}) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)

  await page.goto("/stories")
  await expect(page).toHaveURL("/stories")
  await expect(page.getByRole("heading", { name: "My stories" })).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL("/stories")
  await expect(page.getByRole("heading", { name: "My stories" })).toBeVisible()
})

test("an unknown path renders the client not-found screen (path preserved)", async ({
  page,
}) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)

  await page.goto("/totally/unknown")
  await expect(page).toHaveURL("/totally/unknown")
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible()
})

test("a story deep link resolves the story; the back arrow returns to /stories", async ({
  page,
}) => {
  const story: StoryWire = {
    id: 7,
    text: "Once upon a deep link, the story rendered itself.",
    lang: "en",
    created_at: new Date().toISOString(),
    user_id: "dev|e2e",
    settings: {},
    stats: {},
  }
  await mockBackend(page, { initialStories: [story] })
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)

  await page.goto("/stories/7")
  await expect(page).toHaveURL("/stories/7")
  // The story renders read-only in a textarea, so assert on its value.
  await expect(page.getByRole("textbox")).toHaveValue(/Once upon a deep link/)

  // Refresh keeps us on the story.
  await page.reload()
  await expect(page.getByRole("textbox")).toHaveValue(/Once upon a deep link/)

  // The detail back arrow returns to the stories section; its accessible name
  // now names that destination rather than the generic "home".
  await page.getByRole("button", { name: "Back to my stories" }).click()
  await expect(page).toHaveURL("/stories")
  await expect(page.getByRole("heading", { name: "My stories" })).toBeVisible()
})

test("a story deep link with an unknown id renders not-found", async ({ page }) => {
  await mockBackend(page, { initialStories: [] })
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)

  await page.goto("/stories/99999")
  await expect(page).toHaveURL("/stories/99999")
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible()
})

test("mid-game, browser Back quits the session and stays in-app (no document navigation)", async ({
  page,
}) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")

  // New story → Start writing pushes /new and begins the sprint.
  await page.getByRole("button", { name: "Create a story" }).click()
  await expect(page).toHaveURL("/new")
  await page.getByRole("button", { name: "Start writing" }).click()

  // Arm the sprint with a keystroke so quitting scores it (opens the modal).
  const editor = page.getByRole("textbox")
  await editor.click()
  await editor.pressSequentially("hello world")
  await expect(page.getByRole("button", { name: "Quit session" })).toBeVisible()

  // Back mid-game must quit in-app, not tear the tree down or leave the
  // document (the reported bug jumped straight to Auth0). URL "/" here proves
  // we stayed on the app origin; a jump to Auth0 would fail this assertion.
  await page.goBack()
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("dialog", { name: "Session ended" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Quit session" })).toBeHidden()
})

test("a 'Show all' link pushes the section URL; Back and Forward step through it", async ({
  page,
}) => {
  // The "Show all" links need an account (they open account-gated screens).
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/")

  // Open Statistics from its landing preview card.
  await page.getByRole("button", { name: "Show all: Statistics" }).click()
  await expect(page).toHaveURL("/stats")
  await expect(page.getByRole("heading", { level: 1, name: "Statistics" })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { level: 1, name: "Statistics" })).toBeHidden()

  await page.goForward()
  await expect(page).toHaveURL("/stats")
  await expect(page.getByRole("heading", { level: 1, name: "Statistics" })).toBeVisible()
})

test("logging out resets navigation to the landing", async ({ page }) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)

  await page.goto("/stories")
  await expect(page).toHaveURL("/stories")
  await expect(page.getByRole("heading", { level: 1, name: "My stories" })).toBeVisible()

  // Dev logout is local (no Auth0 redirect); it flips auth to anonymous, which
  // the dashboard resets to the landing.
  await page.getByRole("button", { name: /account menu/i }).click()
  await page.getByRole("menuitem", { name: "Log out" }).click()

  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { level: 1, name: "My stories" })).toBeHidden()
  await expect(page.getByRole("button", { name: /log in/i })).toBeVisible()
})
