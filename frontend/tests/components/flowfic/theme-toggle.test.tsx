import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeToggle } from "@/components/flowfic/theme-toggle"
import type { Locale } from "@/lib/i18n"

import { renderWithLocale } from "../../utils"

type Prefs = {
  theme: "light" | "dark" | null
  setTheme: (m: "light" | "dark") => void
  locale: Locale
  setLocale: (l: Locale) => void
}

const prefs: { current: Prefs } = {
  current: { theme: "light", setTheme: vi.fn(), locale: "en", setLocale: vi.fn() },
}

vi.mock("@/lib/preferences", () => ({
  usePreferences: () => prefs.current,
}))

afterEach(() => vi.clearAllMocks())

describe("ThemeToggle", () => {
  it("shows the active theme and switches to dark from light", async () => {
    const setTheme = vi.fn()
    prefs.current = { theme: "light", setTheme, locale: "en", setLocale: vi.fn() }
    renderWithLocale(<ThemeToggle />)

    const btn = screen.getByRole("button", { name: "Mode" })
    expect(btn).toBeEnabled()
    expect(screen.getByText("Light")).toBeInTheDocument()

    await userEvent.click(btn)
    expect(setTheme).toHaveBeenCalledWith("dark")
  })

  it("switches to light from dark", async () => {
    const setTheme = vi.fn()
    prefs.current = { theme: "dark", setTheme, locale: "en", setLocale: vi.fn() }
    renderWithLocale(<ThemeToggle />)

    expect(screen.getByText("Dark")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Mode" }))
    expect(setTheme).toHaveBeenCalledWith("light")
  })

  it("is disabled until the theme resolves", () => {
    prefs.current = { theme: null, setTheme: vi.fn(), locale: "en", setLocale: vi.fn() }
    renderWithLocale(<ThemeToggle />)
    expect(screen.getByRole("button", { name: "Mode" })).toBeDisabled()
  })
})
