import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { LanguageMenu } from "@/components/flowfic/language-menu"
import type { Locale } from "@/lib/i18n"

import { renderWithLocale } from "../../utils"

const prefs: { current: { locale: Locale; setLocale: (l: Locale) => void } } = {
  current: { locale: "en", setLocale: vi.fn() },
}

vi.mock("@/lib/preferences", () => ({
  usePreferences: () => prefs.current,
}))

afterEach(() => vi.clearAllMocks())

describe("LanguageMenu", () => {
  it("shows the languages icon and the full name of the current locale in the trigger", () => {
    prefs.current = { locale: "en", setLocale: vi.fn() }
    renderWithLocale(<LanguageMenu />)
    const trigger = screen.getByRole("button", { name: "Language" })
    // Icon always renders; the full name shows on md+ (present in the DOM).
    expect(trigger.querySelector("svg")).not.toBeNull()
    expect(trigger).toHaveTextContent("English")
  })

  it("switches the locale from the menu", async () => {
    const setLocale = vi.fn()
    prefs.current = { locale: "en", setLocale }
    renderWithLocale(<LanguageMenu />)

    await userEvent.click(screen.getByRole("button", { name: "Language" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Español" }))
    expect(setLocale).toHaveBeenCalledWith("es")
  })
})
