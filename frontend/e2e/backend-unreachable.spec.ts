import { expect, test } from "@playwright/test"

import { dismissWelcomeBeforeLoad, mockBackend } from "./fixtures"

// When the backend's /ping can't be reached, the header auth control hides
// entirely (no Login button, no dev shortcut) while the rest of the game stays
// playable — there's no offline auth, but writing doesn't require the backend.
test.use({ locale: "en-US" })

test("hides the auth control when the backend is unreachable but keeps the game playable", async ({
  page,
}) => {
  await mockBackend(page, { pingReachable: false })
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")

  // The dashboard is up; New story reveals the settings (they render without a
  // backend).
  await page.getByRole("button", { name: "New story" }).click()
  await expect(page.getByRole("heading", { name: "Session settings" })).toBeVisible()

  // No auth control at all while /ping fails.
  await expect(page.getByRole("button", { name: /^log in$/i })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /dev user login/i })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /account menu/i })).toHaveCount(0)

  // The game itself still works without the backend.
  await page.getByRole("button", { name: "Start writing" }).click()
  await expect(page.getByRole("textbox")).toBeVisible()
})
