import { expect, test, type Page } from "@playwright/test"

import { dismissWelcomeBeforeLoad, mockBackend } from "./fixtures"

// Where the writing column sits, which depends only on whether the inspiration
// pane is up. The regression this guards: with no inspiration picked at all,
// only one of the two gutters rendered, so the column was shoved against the
// opposite edge instead of being centred.
//
// The showcase decides whether a sprint gets an inspiration at all: starting
// with that circle selected carries the pick into the game, starting from any
// other face drops it. The landing opens on the inspiration face and fills it
// straight away, so "no inspiration" now means picking a different circle first.
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

/** Wait for the landing's default face to have filled itself with an
 *  inspiration (50/50 image or quote — either gives the game a pane, which is
 *  all these assertions care about). */
async function awaitInspiration(page: Page) {
  await expect(page.getByRole("button", { name: /another inspiration/i })).toBeVisible()
}

test("starting from another face leaves the game centred, with empty margins", async ({
  page,
}) => {
  await page.goto("/")
  await awaitInspiration(page)

  // Look at something else, and the sprint is deliberately started without an
  // inspiration — even though one was picked while the wand circle was up.
  await page.getByRole("button", { name: "Recent stories" }).click()
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
  await awaitInspiration(page)
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
