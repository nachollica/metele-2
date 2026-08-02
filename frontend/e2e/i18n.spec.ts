import { expect, test } from "@playwright/test"

import { dismissWelcomeBeforeLoad, mockBackend } from "./fixtures"

// The app has no /en or /es routes: locale is detected from the browser
// (navigator.language) after mount, then overridable via preferences. Playwright's
// per-context `locale` sets navigator.language, so we can drive the detection
// path and assert the UI renders in the matching language.

test.describe("English locale", () => {
  test.use({ locale: "en-US" })

  test("renders the dashboard and settings in English", async ({ page }) => {
    await mockBackend(page)
    await dismissWelcomeBeforeLoad(page)
    await page.goto("/")

    // Landing action is localized; opening it shows the localized settings.
    await expect(page.getByRole("button", { name: "Create a story" })).toBeVisible()
    await page.getByRole("button", { name: "Create a story" }).click()
    await expect(page.getByRole("heading", { name: "Session settings" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Start writing" })).toBeVisible()
  })
})

test.describe("Spanish locale", () => {
  test.use({ locale: "es-ES" })

  test("renders the dashboard and settings in Spanish", async ({ page }) => {
    await mockBackend(page)
    await dismissWelcomeBeforeLoad(page)
    await page.goto("/")

    await expect(page.getByRole("button", { name: "Crear una historia" })).toBeVisible()
    await page.getByRole("button", { name: "Crear una historia" }).click()
    await expect(page.getByRole("heading", { name: "Configuración de sesión" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Empezar a escribir" })).toBeVisible()
  })
})
