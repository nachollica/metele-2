import { expect, test } from "@playwright/test"

import { dismissWelcomeBeforeLoad } from "../e2e/fixtures"
import { apiStories, dbStoriesForUser, devLoginViaUi, getDevToken } from "./fixtures"

// Full story CRUD against a real FastAPI app + SQLite DB. Every mutation is
// driven through the browser UI, then verified twice: through the real API and
// by reading the SQLite file directly.
test.use({ locale: "en-US" })

const USER = "e2e"

test("story CRUD persists through the real backend and DB", async ({ page, request }) => {
  const token = await getDevToken(request, USER)
  const marker = `Integration story ${Date.now()}`

  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")
  await devLoginViaUi(page, USER)

  // ---- Create ------------------------------------------------------------
  // Required words off so starting needs no word artifacts (the testing env
  // skips the word pools) and the game begins immediately.
  await page.getByRole("switch", { name: "Enable required words" }).click()
  await page.getByRole("button", { name: "Start writing" }).click()

  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  await textarea.fill(`${marker}. The keeper watched the tide roll in. `)

  await page.getByRole("button", { name: "Quit session" }).click()
  await expect(page.getByRole("dialog").getByText("Session ended")).toBeVisible()
  await page.getByRole("button", { name: "Continue editing" }).click()
  await page.getByRole("button", { name: "Create a story" }).click()

  // Persisted via the real API…
  await expect
    .poll(async () => (await apiStories(request, token)).some((s) => s.text.startsWith(marker)))
    .toBe(true)
  // …and in the raw SQLite file.
  const created = dbStoriesForUser(USER).find((s) => s.text.startsWith(marker))
  expect(created, "story row should exist in SQLite").toBeTruthy()
  const storyId = created!.id

  // ---- Rename ------------------------------------------------------------
  await page.getByRole("button", { name: "My stories" }).click()
  const newTitle = `Renamed ${Date.now()}`
  await page.getByRole("button", { name: "Story options" }).click()
  await page.getByRole("menuitem", { name: /rename/i }).click()
  await page.getByRole("textbox", { name: /story title/i }).fill(newTitle)
  await page.getByRole("button", { name: /save title/i }).click()

  await expect
    .poll(async () => (await apiStories(request, token)).find((s) => s.id === storyId)?.title)
    .toBe(newTitle)
  expect(dbStoriesForUser(USER).find((s) => s.id === storyId)?.title).toBe(newTitle)

  // ---- Delete ------------------------------------------------------------
  await page.getByRole("button", { name: "Story options" }).click()
  await page.getByRole("menuitem", { name: /delete/i }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click()

  await expect
    .poll(async () => (await apiStories(request, token)).some((s) => s.id === storyId))
    .toBe(false)
  expect(dbStoriesForUser(USER).some((s) => s.id === storyId)).toBe(false)
})
