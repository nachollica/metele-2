import { expect, test } from "@playwright/test"

import { dismissWelcomeBeforeLoad, mockBackend } from "./fixtures"

// The app has no /en or /es routes: locale is detected from the browser
// (navigator.language) after mount, then overridable via preferences. Playwright's
// per-context `locale` sets navigator.language, so we can drive the detection
// path and assert the UI renders in the matching language.

test.describe("English locale", () => {
  test.use({ locale: "en-US" })

  test("renders the home dashboard in English", async ({ page }) => {
    await mockBackend(page)
    await dismissWelcomeBeforeLoad(page)
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Write non-stop" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible()
  })
})

test.describe("Spanish locale", () => {
  test.use({ locale: "es-ES" })

  test("renders the home dashboard in Spanish", async ({ page }) => {
    await mockBackend(page)
    await dismissWelcomeBeforeLoad(page)
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "Escribí sin parar" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Comenzar", exact: true })).toBeVisible()
  })
})
