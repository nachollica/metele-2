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

  // Signed-in users skip the welcome modal and land on the dashboard; New story
  // reveals the settings, then Start writing begins the sprint.
  await page.getByRole("button", { name: "New story" }).click()
  await page.getByRole("button", { name: "Start writing" }).click()

  const story = "Lighthouse keepers count the waves at dusk. "
  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  await textarea.fill(story)

  // Quit ends the (armed) session and opens the stats modal.
  await page.getByRole("button", { name: "Quit session" }).click()
  await expect(page.getByRole("dialog").getByText("Session ended")).toBeVisible()

  // Close the modal, then "Create a story" leaves the ended state — which is
  // what triggers the save.
  await page.getByRole("button", { name: "Continue editing" }).click()
  await page.getByRole("button", { name: "Create a story" }).click()

  // The frontend POSTed exactly one story with the expected contract.
  await expect.poll(() => backend.postedStories.length).toBe(1)
  const posted = backend.postedStories[0]
  expect(posted.text).toBe(story)
  expect(posted.lang).toBe("en")
  expect(posted.stats).toMatchObject({ reason: "manual", words: 7 })

  // "Create a story" returns to the landing dashboard; open the full My-stories
  // screen from its "Show all" link. The post-save refetch surfaces the story
  // there, with a title derived from the opening words of the text (exact
  // match, so it doesn't also collide with the two-line body preview beneath).
  await page.getByRole("button", { name: "Show all: My stories" }).click()
  await expect(
    page.getByText("Lighthouse keepers count the waves at", { exact: true }),
  ).toBeVisible()
})
