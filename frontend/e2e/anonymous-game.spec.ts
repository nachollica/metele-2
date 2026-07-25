import { expect, test } from "@playwright/test"

import { dismissWelcomeBeforeLoad, mockBackend } from "./fixtures"

// Journeys playable without an account. The app boots into the Home dashboard
// regardless of auth, so these don't depend on Auth0 resolving — but we still
// stub /api/** so no stray request escapes to a real backend.
test.beforeEach(async ({ page }) => {
  await mockBackend(page)
})

test("first visit shows the welcome modal, which dismisses to the home dashboard", async ({
  page,
}) => {
  await page.goto("/")

  // The first-visit tutorial floats over the dashboard.
  const skip = page.getByRole("button", { name: "Skip tutorial" })
  await expect(skip).toBeVisible()
  await skip.click()

  // Dismissed -> the home quick-start card is interactive.
  await expect(page.getByRole("heading", { name: "Write non-stop" })).toBeVisible()
  await expect(skip).toBeHidden()
})

test("start -> type -> quit shows the results modal with session stats", async ({
  page,
}) => {
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")

  await page.getByRole("button", { name: "Start", exact: true }).click()

  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  // Typing arms the timers; once armed, an explicit quit scores the session.
  await textarea.fill("The quick brown fox jumps over the lazy dog. ")

  await page.getByRole("button", { name: "Quit session" }).click()

  const results = page.getByRole("dialog")
  await expect(results.getByText("Session ended")).toBeVisible()
  await expect(results.getByText("You ended the session.")).toBeVisible()
  // 9 words were written; the stats grid should reflect that.
  await expect(results.getByText("Words", { exact: true })).toBeVisible()
  await expect(results.getByText("9", { exact: true })).toBeVisible()
})

test("the idle timeout ends the session on its own", async ({ page }) => {
  // Control time so the 15s default idle timeout fires instantly and
  // deterministically instead of waiting on the wall clock.
  await page.clock.install()
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")

  await page.getByRole("button", { name: "Start", exact: true }).click()

  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  // One keystroke arms the idle timer (default: 15s of inactivity).
  await textarea.pressSequentially("a")

  // Jump past the idle deadline without any further input.
  await page.clock.fastForward("00:16")

  const results = page.getByRole("dialog")
  await expect(results.getByText("Session ended")).toBeVisible()
  await expect(
    results.getByText("You stopped typing for too long."),
  ).toBeVisible()
})
