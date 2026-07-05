import { expect, test } from "@playwright/test"

import { mockBackend, seedDevSession } from "./fixtures"

// The required-word lifecycle: a word spawns, and typing it clears the panel.
//
// Two things make this deterministic despite the randomized spawn interval:
//   - The word VALUE: enabling custom categories makes the game draw words from
//     the backend `/words/related` pool, which we stub to a single known word.
//     (The custom-pool fetch only runs for a signed-in user, hence the dev
//     session.)
//   - The spawn TIME: we drive the interval slider to its minimum and use a
//     virtual clock, typing between ticks so the idle timeout never fires while
//     we wait for the word to appear.
test.use({ locale: "en-US" })

test("a required word spawns and is cleared by typing it", async ({ page }) => {
  await mockBackend(page, { relatedWords: ["banana"] })
  await seedDevSession(page)
  await page.clock.install()
  await page.goto("/")

  // Turn on custom categories and give a seed so startGame fetches the pool.
  await page
    .getByRole("switch", { name: "Use custom word categories" })
    .click()
  await page
    .getByRole("textbox", { name: "Custom word categories" })
    .fill("fruit")

  // Drive "New required word every" to its minimum (5s) so a word spawns
  // quickly. The slider thumb carries the setting's label as its accessible
  // name, so we can target it directly instead of by DOM order.
  const wordIntervalSlider = page.getByRole("slider", {
    name: "New required word every",
  })
  await wordIntervalSlider.focus()
  await wordIntervalSlider.press("Home")

  await page.getByRole("button", { name: "Start writing" }).click()

  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  // First keystroke arms the timers.
  await textarea.pressSequentially("a")

  const wordPanel = page.getByRole("complementary", { name: "Required word" })
  await expect(wordPanel.getByText("Keep writing", { exact: false })).toBeVisible()

  // Advance the virtual clock in 1s steps until the word appears, typing each
  // step to keep the idle timer from firing.
  for (let i = 0; i < 30; i++) {
    await page.clock.fastForward(1000)
    if (await wordPanel.getByText("banana").isVisible().catch(() => false)) break
    await textarea.pressSequentially(" a")
  }
  await expect(wordPanel.getByText("banana")).toBeVisible()

  // Typing the required word (followed by a delimiter) clears it.
  await textarea.pressSequentially(" banana ")
  await expect(wordPanel.getByText("banana")).toBeHidden()
  await expect(wordPanel.getByText("Keep writing", { exact: false })).toBeVisible()
})
