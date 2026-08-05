import { expect, test } from "@playwright/test"

import { dismissWelcomeBeforeLoad, mockBackend } from "./fixtures"

// Journeys playable without an account. The app boots into the landing
// dashboard regardless of auth, so these don't depend on Auth0 resolving — but
// we still stub /api/** so no stray request escapes to a real backend.
test.beforeEach(async ({ page }) => {
  await mockBackend(page)
})

test("first visit shows the welcome modal, which dismisses to the landing dashboard", async ({
  page,
}) => {
  await page.goto("/")

  // The first-visit tutorial floats over the dashboard.
  const skip = page.getByRole("button", { name: "Skip tutorial" })
  await expect(skip).toBeVisible()
  await skip.click()

  // Dismissed -> the landing dashboard is shown, with the session launcher
  // ready to start a sprint straight away.
  await expect(page.getByRole("button", { name: "Start writing" })).toBeVisible()
  await expect(skip).toBeHidden()
})

test("start -> type -> quit shows the results modal with session stats", async ({
  page,
}) => {
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")

  // The launcher's Start button begins the sprint directly — there is no
  // separate configurator screen any more.
  await page.getByRole("button", { name: "Start writing" }).click()

  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  // Typing arms the timers; once armed, an explicit quit scores the session.
  await textarea.fill("The quick brown fox jumps over the lazy dog. ")

  // Quit asks for confirmation before ending the sprint.
  await page.getByRole("button", { name: "Quit session" }).click()
  await page.getByRole("button", { name: "Quit", exact: true }).click()

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

  await page.getByRole("button", { name: "Start writing" }).click()

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
