import { expect, test } from "@playwright/test"

import {
  dismissWelcomeBeforeLoad,
  mockBackend,
  readStoredDraft,
  seedDevSession,
  seedPendingStory,
} from "./fixtures"

// Keeping a story that was written without an account.
//
// The real sign-in is a full-page redirect to Auth0 and back, which no browser
// test can walk. What it comes down to for the app is: the draft is written
// down and flagged, the document is replaced, and the app reboots
// authenticated. These specs reproduce exactly that — click the provider (which
// is what flags the draft), then seed a dev session and reload, which is a
// reboot into an authenticated app from the same origin.
test.use({ locale: "en-US" })

const STORY = "Lighthouse keepers count the waves at dusk. "

// Play a full sprint anonymously and land on the ended screen, where the story
// is finished, still editable, and has nowhere to go.
async function finishStoryAnonymously(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Start writing" }).click()
  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  await textarea.fill(STORY)

  await page.getByRole("button", { name: "Quit session" }).click()
  await page.getByRole("button", { name: "Quit", exact: true }).click()
  await expect(page.getByRole("dialog").getByText("Session ended")).toBeVisible()
  await page.getByRole("button", { name: "Continue editing" }).click()
}

test("saving without an account offers a sign-in instead of dropping the story", async ({
  page,
}) => {
  const backend = await mockBackend(page)
  // Picking a provider hands the document over to Auth0 for real. Stop the
  // navigation so the test stays on the page it is asserting about.
  await page.route(/\/authorize/, (route) => route.abort())
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")

  await finishStoryAnonymously(page)
  await page.getByLabel("Story title").fill("The Keeper's Count")

  // Save can't save anything yet, so it asks rather than dropping the story.
  await page.getByRole("button", { name: "Save story" }).click()
  await expect(
    page.getByRole("heading", { name: "Sign in to save this story" }),
  ).toBeVisible()
  expect(backend.postedStories).toHaveLength(0)

  // The story is written down before any of this, so it is already safe.
  const draft = (await readStoredDraft(page)) as { payload?: { text?: string } } | null
  expect(draft?.payload?.text).toBe(STORY)
})

test("a story flagged for saving is saved and opened once the app comes back signed in", async ({
  page,
}) => {
  // The far side of the redirect. Seeding the flagged draft rather than
  // clicking through Auth0 keeps this deterministic: whether the provider
  // button navigates at all depends on the Auth0 env vars being set, which is
  // true on a dev machine and false on CI. That the button sets the flag before
  // handing over is covered in the LoginModal unit tests.
  const backend = await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await seedPendingStory(page, { intent: true, title: "The Keeper's Count", text: STORY })
  await seedDevSession(page)
  await page.goto("/")

  // Saved on its own, with the title typed in the epilogue intact.
  await expect.poll(() => backend.postedStories.length).toBe(1)
  expect(backend.postedStories[0].title).toBe("The Keeper's Count")
  expect(backend.postedStories[0].text).toBe(STORY)

  // And it lands on the story itself — the clearest statement that the text
  // survived — with the draft cleared behind it.
  await expect(page).toHaveURL(/\/stories\/\d+$/)
  await expect(page.getByRole("textbox")).toHaveValue(STORY)
  expect(await readStoredDraft(page)).toBeNull()
})

test("leaving without saving takes a confirmation, and backing out keeps the story", async ({
  page,
}) => {
  const backend = await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")

  await finishStoryAnonymously(page)
  await page.getByRole("button", { name: "Save story" }).click()

  // First step: the way out is offered, but it doesn't fire yet.
  await page.getByRole("button", { name: "Return to home page" }).click()
  await expect(page.getByRole("heading", { name: "Lose this story?" })).toBeVisible()
  expect(await readStoredDraft(page)).not.toBeNull()

  // Backing out returns to the sign-in step rather than closing everything.
  await page.getByRole("button", { name: "Keep my story" }).click()
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible()
  expect(await readStoredDraft(page)).not.toBeNull()

  // Confirming is what actually drops it.
  await page.getByRole("button", { name: "Return to home page" }).click()
  await page.getByRole("button", { name: "Discard the story" }).click()

  await expect(page.getByRole("button", { name: "Start writing" })).toBeVisible()
  expect(await readStoredDraft(page)).toBeNull()
  expect(backend.postedStories).toHaveLength(0)
})

test("every exit asks, including the one that used to surface a false save error", async ({
  page,
}) => {
  // The reported bug: finish a story anonymously, walk away, start another
  // sprint — and the previous story's save failure turned up over the new,
  // empty one, with a Retry that could never succeed.
  const backend = await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")

  await finishStoryAnonymously(page)

  // Exit 1: the brand logo, which goes home. The navigation goes through and
  // the prompt opens over the landing.
  await page.getByRole("button", { name: "Flowfic" }).click()
  await expect(
    page.getByRole("heading", { name: "Sign in to save this story" }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Leave without saving" })).toBeVisible()

  // Dismissing is a soft "not now": the draft stays put.
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()
  expect(await readStoredDraft(page)).not.toBeNull()

  // Exit 2: starting another sprint asks again, naming that destination.
  await page.getByRole("button", { name: "Start writing" }).click()
  await expect(
    page.getByRole("heading", { name: "Sign in to save this story" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Start a new story anyway" }).click()
  await page.getByRole("button", { name: "Discard the story" }).click()

  // The new sprint begins on a blank page, with no failure alert anywhere —
  // nothing failed, so nothing is claimed to have.
  const textarea = page.getByRole("textbox")
  await expect(textarea).toBeVisible()
  await expect(textarea).toHaveValue("")
  // Scoped to the alert's own text: Next's route announcer is also role=alert.
  await expect(page.getByText("Couldn't save your last story.")).toBeHidden()
  expect(backend.postedStories).toHaveLength(0)
})

test("a draft nobody asked us to keep is offered, not saved behind their back", async ({
  page,
}) => {
  // Signed in for some unrelated reason, with a story left over from an
  // earlier visit that was never flagged for saving.
  const backend = await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await seedPendingStory(page, { intent: false, title: "An older draft" })
  await seedDevSession(page)
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "You have an unsaved story" })).toBeVisible()
  // Nothing was saved just by arriving.
  expect(backend.postedStories).toHaveLength(0)
  await expect(page.getByText(/An older draft — 8 words/)).toBeVisible()

  await page.getByRole("button", { name: "Save it to my stories" }).click()

  await expect.poll(() => backend.postedStories.length).toBe(1)
  expect(backend.postedStories[0].title).toBe("An older draft")
  await expect(page).toHaveURL(/\/stories\/\d+$/)
  expect(await readStoredDraft(page)).toBeNull()
})

test("an offered draft can be thrown away, and stays gone", async ({ page }) => {
  const backend = await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await seedPendingStory(page, { intent: false, title: "An older draft" })
  await seedDevSession(page)
  await page.goto("/")

  await page.getByRole("button", { name: "Discard it" }).click()
  await page.getByRole("button", { name: "Discard the story" }).click()

  await expect(page.getByRole("heading", { name: "You have an unsaved story" })).toBeHidden()
  expect(await readStoredDraft(page)).toBeNull()
  expect(backend.postedStories).toHaveLength(0)
})
