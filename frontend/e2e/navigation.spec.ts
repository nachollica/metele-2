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

test("'More options' pushes /new; browser Back closes the settings panel", async ({
  page,
}) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { name: "Advanced settings" })).toBeHidden()

  await page.getByRole("button", { name: "More options" }).click()
  await expect(page).toHaveURL("/new")
  await expect(page.getByRole("heading", { name: "Advanced settings" })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { name: "Advanced settings" })).toBeHidden()
  // The recent-stories face is back in the swappable panel.
  await expect(page.getByRole("heading", { name: "Recent stories" })).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL("/new")
  await expect(page.getByRole("heading", { name: "Advanced settings" })).toBeVisible()
})

test("a deep link at /new opens the home screen with the settings panel already open", async ({
  page,
}) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)

  await page.goto("/new")
  await expect(page).toHaveURL("/new")
  await expect(page.getByRole("heading", { name: "Advanced settings" })).toBeVisible()
  // Still the home screen — the launcher is right there above the panel.
  await expect(page.getByRole("button", { name: "Start writing" })).toBeVisible()
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
    title: null,
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

  // Open the settings panel first so there is a /new entry to step back from,
  // then start the sprint.
  await page.getByRole("button", { name: "More options" }).click()
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
  // This path bypasses the quit confirmation on purpose — Back is an explicit
  // exit, not a click on the Quit control.
  await page.goBack()
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("dialog", { name: "Session ended" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Quit session" })).toBeHidden()
})

test("the account menu pushes the section URL; Back and Forward step through it", async ({
  page,
}) => {
  // The section screens are account-gated, so drive them signed in.
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/")

  // My Journey no longer has a landing card; the account menu is its entry
  // point (the landing's own "Show all" now only covers Recent stories).
  await page.getByRole("button", { name: /account menu/i }).click()
  await page.getByRole("menuitem", { name: "My Journey" }).click()
  await expect(page).toHaveURL("/journey")
  await expect(page.getByRole("heading", { level: 1, name: "My Journey" })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { level: 1, name: "My Journey" })).toBeHidden()

  await page.goForward()
  await expect(page).toHaveURL("/journey")
  await expect(page.getByRole("heading", { level: 1, name: "My Journey" })).toBeVisible()
})

test("the landing's 'Show all' opens the stories section", async ({ page }) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/")

  await page.getByRole("button", { name: "Show all: My stories" }).click()
  await expect(page).toHaveURL("/stories")
  await expect(page.getByRole("heading", { level: 1, name: "My stories" })).toBeVisible()
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
