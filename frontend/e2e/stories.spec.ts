import { expect, test } from "@playwright/test"

import {
  dismissWelcomeBeforeLoad,
  mockBackend,
  openRecentStories,
  seedDevSession,
  type StoryWire,
} from "./fixtures"

// The My-stories detail screen: the library's size, and paging past the first
// request. `useStories` asks for 100 at a time, so a bigger library is what
// makes the second page exist at all — before "Load more" the list simply
// stopped at that number with nothing saying so.
test.use({ locale: "en-US" })

const TOTAL = 150

function library(): StoryWire[] {
  return Array.from({ length: TOTAL }, (_, i) => ({
    id: i + 1,
    title: `Story number ${i + 1}`,
    text: "The lighthouse keeper counted the waves at dusk.",
    lang: "en",
    created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
    user_id: "dev|e2e",
    settings: {},
    stats: { words: 100 + i },
  }))
}

test("My stories heads the list with the library's size and pages through it", async ({
  page,
}) => {
  await mockBackend(page, { initialStories: library() })
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/stories")

  // The count is the whole library, not the page that happens to be loaded.
  await expect(page.getByText(`${TOTAL} stories`)).toBeVisible()
  await expect(page.getByRole("button", { name: /^Story number 1 /i })).toBeVisible()
  // Page one stops at 100, so the last story is not here yet.
  await expect(page.getByRole("button", { name: `Story number ${TOTAL} —` })).toBeHidden()

  await page.getByRole("button", { name: "Load more" }).click()

  // The rest arrive appended, and the control retires once nothing is left.
  await expect(page.getByRole("button", { name: `Story number ${TOTAL} —` })).toBeVisible()
  await expect(page.getByRole("button", { name: "Load more" })).toBeHidden()
  // Still one row per story — the seam between pages must not duplicate any.
  await expect(page.getByRole("button", { name: /^Story number \d+ —/ })).toHaveCount(TOTAL)
})

test("the landing preview links into the full list", async ({ page }) => {
  await mockBackend(page, { initialStories: library() })
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/")

  // The preview shows a handful; the count only appears on the detail screen.
  await openRecentStories(page)
  await expect(page.getByText(`${TOTAL} stories`)).toBeHidden()

  await page.getByRole("button", { name: "Show all: My stories" }).click()
  await expect(page).toHaveURL("/stories")
  await expect(page.getByText(`${TOTAL} stories`)).toBeVisible()
})
