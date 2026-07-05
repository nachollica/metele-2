import { expect, test } from "@playwright/test"

import { mockBackend, seedDevSession } from "./fixtures"

// The save-story journey, exercised as a signed-in user via the dev-user
// backdoor (a pure-localStorage session — no Auth0). The backend is stubbed so
// we can both assert the POST payload contract and confirm the saved story
// flows back into the sidebar on the follow-up refetch.
test.use({ locale: "en-US" })

test("a finished session is saved to the backend and shows in the sidebar", async ({
  page,
}) => {
  const backend = await mockBackend(page)
  await seedDevSession(page)
  await page.goto("/")

  // Signed-in users skip the welcome modal and land straight on settings.
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

  // The post-save refetch surfaces it in the recent-stories sidebar.
  const sidebar = page.getByRole("complementary", { name: "Recent stories" })
  await expect(
    sidebar.getByText("Lighthouse keepers count the waves at dusk."),
  ).toBeVisible()
})
