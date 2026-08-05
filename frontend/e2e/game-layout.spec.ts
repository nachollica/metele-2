import { expect, test, type Page } from "@playwright/test"

import { dismissWelcomeBeforeLoad, mockBackend } from "./fixtures"

// Where the writing column sits, which depends only on whether the inspiration
// pane is up. The regression this guards: with no inspiration picked at all,
// only one of the two gutters rendered, so the column was shoved against the
// opposite edge instead of being centred.
test.use({ locale: "en-US" })

const VIEWPORT = { width: 1280, height: 800 }

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
})

/** Horizontal centre of the editor, and of the viewport, to compare against. */
async function editorCentre(page: Page): Promise<number> {
  const box = await page.getByRole("textbox").boundingBox()
  if (!box) throw new Error("editor not visible")
  return Math.round(box.x + box.width / 2)
}

/** Reveal an inspiration on the home screen (50/50 image or quote — either
 *  gives the game a pane, which is all these assertions care about). */
async function pickInspiration(page: Page) {
  const card = page.getByRole("button", { name: /inspiration/i })
  await card.scrollIntoViewIfNeeded()
  await card.click()
  await expect(page.getByRole("button", { name: /another inspiration/i })).toBeVisible()
}

test("with no inspiration picked, the game is centred and the margins are empty", async ({
  page,
}) => {
  await page.goto("/")
  // Straight to Start, exactly as a first-time player would.
  await page.getByRole("button", { name: "Start writing" }).click()
  await expect(page.getByRole("textbox")).toBeVisible()

  expect(await editorCentre(page)).toBe(VIEWPORT.width / 2)
  // Nothing to show or hide, so neither control exists.
  await expect(page.getByRole("button", { name: "Show inspiration" })).toBeHidden()
  await expect(page.getByRole("button", { name: "Hide inspiration" })).toBeHidden()
})

test("an inspiration takes the right pane, and hiding it re-centres the game", async ({
  page,
}) => {
  await page.goto("/")
  await pickInspiration(page)
  await page.getByRole("button", { name: "Start writing" }).click()
  await expect(page.getByRole("textbox")).toBeVisible()

  // Shown: the column shares the row with the pane, so it sits left of centre.
  const beside = await editorCentre(page)
  expect(beside).toBeLessThan(VIEWPORT.width / 2)

  // Hidden: back to the same centred measure as the no-inspiration case, with
  // the wand left behind in the right margin.
  await page.getByRole("button", { name: "Hide inspiration" }).click()
  await expect(page.getByRole("button", { name: "Show inspiration" })).toBeVisible()
  expect(await editorCentre(page)).toBe(VIEWPORT.width / 2)

  // And back again, landing exactly where it started.
  await page.getByRole("button", { name: "Show inspiration" }).click()
  await expect(page.getByRole("button", { name: "Hide inspiration" })).toBeVisible()
  expect(await editorCentre(page)).toBe(beside)
})
