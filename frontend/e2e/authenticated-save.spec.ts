import { expect, test } from "@playwright/test"

import { mockBackend, seedDevSession } from "./fixtures"

// The save-story journey, exercised as a signed-in user via the dev-user
// backdoor (a pure-localStorage session — no Auth0). The backend is stubbed so
// we can both assert the POST payload contract and confirm the saved story
// flows back into the My-stories screen on the follow-up refetch.
test.use({ locale: "en-US" })

test("a finished session is saved to the backend and shows in My stories", async ({
  page,
}) => {
  const backend = await mockBackend(page)
  await seedDevSession(page)
  await page.goto("/")

  // Signed-in users skip the welcome modal and land on the dashboard, whose
  // launcher starts the sprint directly.
  await page.getByRole("button", { name: "Start writing" }).click()

  const story = "Lighthouse keepers count the waves at dusk. "
  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  await textarea.fill(story)

  // Quit ends the (armed) session and opens the stats modal.
  await page.getByRole("button", { name: "Quit session" }).click()
  await page.getByRole("button", { name: "Quit", exact: true }).click()
  await expect(page.getByRole("dialog").getByText("Session ended")).toBeVisible()

  // Close the modal, name the story, then Save performs the final checkout —
  // which is what triggers the POST.
  await page.getByRole("button", { name: "Continue editing" }).click()
  await page.getByLabel("Story title").fill("The Keeper's Count")
  await page.getByRole("button", { name: "Save story" }).click()

  // The frontend POSTed exactly one story with the expected contract.
  await expect.poll(() => backend.postedStories.length).toBe(1)
  const posted = backend.postedStories[0]
  expect(posted.title).toBe("The Keeper's Count")
  expect(posted.text).toBe(story)
  expect(posted.lang).toBe("en")
  expect(posted.stats).toMatchObject({ reason: "manual", words: 7 })

  // Saving returns to the landing dashboard; open the full My-stories screen
  // from its "Show all" link. The post-save refetch surfaces the story there,
  // under the name the player gave it rather than one derived from the text.
  await page.getByRole("button", { name: "Show all: My stories" }).click()
  await expect(page.getByText("The Keeper's Count", { exact: true })).toBeVisible()
})

test("a story saved without a title falls back to one derived from the text", async ({
  page,
}) => {
  const backend = await mockBackend(page)
  await seedDevSession(page)
  await page.goto("/")

  await page.getByRole("button", { name: "Start writing" }).click()
  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  await textarea.fill("Lighthouse keepers count the waves at dusk. ")

  await page.getByRole("button", { name: "Quit session" }).click()
  await page.getByRole("button", { name: "Quit", exact: true }).click()
  await page.getByRole("button", { name: "Continue editing" }).click()
  // Leave the title field untouched: it posts null, and the client derives a
  // title from the opening words instead.
  await page.getByRole("button", { name: "Save story" }).click()

  await expect.poll(() => backend.postedStories.length).toBe(1)
  expect(backend.postedStories[0].title).toBeNull()

  await page.getByRole("button", { name: "Show all: My stories" }).click()
  await expect(
    page.getByText("Lighthouse keepers count the waves at", { exact: true }),
  ).toBeVisible()
})
