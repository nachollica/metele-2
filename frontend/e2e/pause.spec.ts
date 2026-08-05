import { expect, test } from "@playwright/test"

import { dismissWelcomeBeforeLoad, mockBackend } from "./fixtures"

// Pausing a sprint. The load-bearing behaviour is that the timers really stop:
// a paused game must survive a fast-forward well past the idle deadline that
// would otherwise have ended it. A virtual clock makes that deterministic.
test.use({ locale: "en-US" })

test.beforeEach(async ({ page }) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
})

/** Start a sprint and arm the timers with one keystroke. */
async function startArmedSprint(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Start writing" }).click()
  const editor = page.getByRole("textbox")
  await expect(editor).toBeVisible()
  await editor.pressSequentially("Once upon a time")
  return editor
}

test("pause freezes the timers; the idle timeout can't fire while held", async ({ page }) => {
  await page.clock.install()
  await startArmedSprint(page)

  await page.getByRole("button", { name: "Pause" }).click()
  await expect(page.getByText("Paused")).toBeVisible()

  // Well past the 15s default idle deadline. A running timer would have ended
  // the session here; a frozen one must not.
  await page.clock.fastForward("01:00")
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(page.getByText("Paused")).toBeVisible()

  // Resuming restarts the clock from where it stopped: the idle timeout is
  // live again and fires after its full remaining span.
  await page.getByRole("button", { name: "Resume" }).click()
  await expect(page.getByText("Paused")).toBeHidden()
  await page.clock.fastForward("00:16")
  await expect(page.getByRole("dialog").getByText("Session ended")).toBeVisible()
  await expect(
    page.getByRole("dialog").getByText("You stopped typing for too long."),
  ).toBeVisible()
})

test("the editor is read-only while paused and regains focus, caret at the end, on resume", async ({
  page,
}) => {
  const editor = await startArmedSprint(page)

  await page.getByRole("button", { name: "Pause" }).click()
  await expect(editor).toHaveAttribute("readonly", "")

  // Typing while paused changes nothing.
  await editor.pressSequentially(" ignored", { timeout: 2000 }).catch(() => {})
  await expect(editor).toHaveValue("Once upon a time")

  await page.getByRole("button", { name: "Resume" }).click()
  await expect(editor).not.toHaveAttribute("readonly", "")

  // Focus is handed back with the caret at the end of the story, so the player
  // just keeps typing — no click needed.
  await expect(editor).toBeFocused()
  const caret = await editor.evaluate(
    (el) => (el as HTMLTextAreaElement).selectionStart,
  )
  expect(caret).toBe("Once upon a time".length)

  await page.keyboard.type(", quietly.")
  await expect(editor).toHaveValue("Once upon a time, quietly.")
})

test("quit asks first: cancelling leaves the game paused, confirming ends it", async ({
  page,
}) => {
  await page.clock.install()
  await startArmedSprint(page)

  // Opening the confirmation pauses the sprint — the player can't watch the
  // clock run down behind a modal they're reading.
  await page.getByRole("button", { name: "Quit session" }).click()
  await expect(page.getByRole("alertdialog")).toBeVisible()
  await expect(page.getByRole("alertdialog").getByText("Quit this session?")).toBeVisible()

  await page.getByRole("button", { name: "Keep writing" }).click()
  await expect(page.getByRole("alertdialog")).toBeHidden()
  // Still paused, not silently resumed.
  await expect(page.getByText("Paused")).toBeVisible()
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible()

  // And still frozen: the idle deadline can't fire.
  await page.clock.fastForward("01:00")
  await expect(page.getByRole("dialog", { name: "Session ended" })).toBeHidden()

  // Quitting again and confirming ends the sprint and shows the stats.
  await page.getByRole("button", { name: "Quit session" }).click()
  await page.getByRole("button", { name: "Quit", exact: true }).click()
  await expect(page.getByRole("dialog").getByText("Session ended")).toBeVisible()
  await expect(page.getByRole("dialog").getByText("You ended the session.")).toBeVisible()
})
