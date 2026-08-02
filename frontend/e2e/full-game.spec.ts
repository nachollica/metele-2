import { expect, test } from "@playwright/test"

import { mockBackend, seedDevSession } from "./fixtures"

// End-to-end game journey with deterministic timing:
//   load → configure → start → write → a required word appears → type it
//   (used-count +1) → quit → the results modal reports the session stats.
//
// The real game spawns required words at a randomized interval, which would
// make timing flaky. Two things make this deterministic:
//   - VALUE: a seed makes startGame draw from the backend related pool, which
//     we stub to the single word "banana".
//   - TIME: the interval slider is driven to its minimum and we advance a
//     virtual clock, typing between ticks so the idle timeout never fires.
test.use({ locale: "en-US" })

test("full session: required word satisfied (+1) and stats shown on finish", async ({
  page,
}) => {
  await mockBackend(page, { relatedWords: ["banana"] })
  await seedDevSession(page)
  await page.clock.install()
  await page.goto("/")

  // New story reveals the session settings. Configure there: a seed makes
  // startGame fetch the (stubbed) related pool, and the minimum interval makes a
  // word spawn quickly.
  await page.getByRole("button", { name: "Create a story" }).click()
  await page.getByRole("textbox", { name: "Word seeds" }).fill("fruit")
  const interval = page.getByRole("slider", { name: "New required word every" })
  await interval.focus()
  await interval.press("Home")

  await page.getByRole("button", { name: "Start writing" }).click()

  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  // First keystrokes arm the timers.
  await textarea.pressSequentially("Once upon a time ")

  const wordPanel = page.getByRole("complementary", { name: "Required word" })
  await expect(wordPanel.getByText("Keep writing", { exact: false })).toBeVisible()

  // Advance the virtual clock until the stubbed word appears, typing each step
  // so the idle timer never fires while we wait.
  for (let i = 0; i < 30; i++) {
    await page.clock.fastForward(1000)
    if (await wordPanel.getByText("banana").isVisible().catch(() => false)) break
    await textarea.pressSequentially("word ")
  }
  await expect(wordPanel.getByText("banana")).toBeVisible()

  // Typing the required word (followed by a delimiter) satisfies it.
  await textarea.pressSequentially("banana ")
  await expect(wordPanel.getByText("banana")).toBeHidden()
  await expect(wordPanel.getByText("Keep writing", { exact: false })).toBeVisible()

  // Finish the session; the results modal reports the stats.
  await page.getByRole("button", { name: "Quit session" }).click()

  const results = page.getByRole("dialog")
  await expect(results.getByText("Session ended")).toBeVisible()
  await expect(results.getByText("You ended the session.")).toBeVisible()

  // The four stat tiles are present…
  await expect(results.getByText("Duration")).toBeVisible()
  await expect(results.getByText("Characters written")).toBeVisible()
  await expect(results.getByText("Words", { exact: true })).toBeVisible()
  await expect(results.getByText("Required words used")).toBeVisible()

  // …and exactly one required word was used. "1" is unambiguous here: the
  // duration is "MM:SS", and characters/words are both well above 1.
  await expect(results.getByText("1", { exact: true })).toBeVisible()
})
