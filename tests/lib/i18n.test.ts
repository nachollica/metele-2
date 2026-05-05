import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getTranslations,
  resolveLocale,
} from "@/lib/i18n/config"

describe("resolveLocale", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the locale unchanged when supported", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(resolveLocale(locale)).toBe(locale)
    }
  })

  it("falls back to the default and warns when locale is unsupported", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(resolveLocale("fr")).toBe(DEFAULT_LOCALE)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toMatch(/not supported/i)
  })

  it("falls back silently when locale is empty/undefined", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE)
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("getTranslations", () => {
  it("returns a non-empty dictionary for every supported locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const dict = getTranslations(locale)
      expect(dict.app.title).toBeTruthy()
      expect(dict.settings.start).toBeTruthy()
      expect(dict.auth.logIn).toBeTruthy()
    }
  })

  it("English and Spanish dictionaries share the same shape", () => {
    const en = getTranslations("en")
    const es = getTranslations("es")
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
    expect(Object.keys(en.auth).sort()).toEqual(Object.keys(es.auth).sort())
    expect(Object.keys(en.settings).sort()).toEqual(Object.keys(es.settings).sort())
    expect(Object.keys(en.presets).sort()).toEqual(Object.keys(es.presets).sort())
  })
})
