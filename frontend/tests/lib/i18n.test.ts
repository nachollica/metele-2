import { describe, expect, it } from "vitest"

import {
  SUPPORTED_LOCALES,
  getTranslations,
} from "@/lib/i18n/config"

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
