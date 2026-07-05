import { expect, test } from "@playwright/test"

import { dismissWelcomeBeforeLoad, mockBackend } from "./fixtures"

// The dev-user backdoor as a player would reach it: the small dashed button
// left of "Log in" (rendered because the stubbed GET /ping reports
// devUserEnabled: true). The backend is stubbed so no Auth0 tenant is hit.
test.use({ locale: "en-US" })

test("a dev user signs in through the header dev-login button", async ({ page }) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/")

  // Anonymous header shows the dev shortcut to the left of the real CTA.
  await expect(page.getByRole("button", { name: /log in/i })).toBeVisible()
  await page.getByRole("button", { name: /dev user login/i }).click()

  await page.getByLabel(/dev username/i).fill("alice")
  await page.getByRole("button", { name: /log in as dev user/i }).click()

  // Session is now authenticated: the CTA is replaced by the account menu and
  // the dev shortcut is gone.
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible()
  await expect(
    page.getByRole("button", { name: /dev user login/i }),
  ).toBeHidden()
})
