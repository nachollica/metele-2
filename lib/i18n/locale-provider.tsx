"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { LocaleContext, SetLocaleContext } from "@/lib/i18n"
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "./config"

// Try to match a `navigator.language` style tag (e.g. "es-AR", "en-US") to a
// supported locale. Falls back to the default when nothing matches.
function detectLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language]
  for (const tag of candidates) {
    const base = tag.toLowerCase().split("-")[0]
    const match = SUPPORTED_LOCALES.find((l) => l === base)
    if (match) return match
  }
  return DEFAULT_LOCALE
}

// Provides locale + setter to descendants. Initial render uses the default
// locale so SSR/static HTML matches the first client render. After mount we
// detect the browser locale; the per-user `PreferencesProvider` may then
// overwrite it if the signed-in user has a stored preference.
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [detected, setDetected] = useState(false)

  useEffect(() => {
    if (detected) return
    setLocaleState(detectLocale())
    setDetected(true)
  }, [detected])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    setDetected(true)
  }, [])

  return (
    <LocaleContext value={locale}>
      <SetLocaleContext value={setLocale}>{children}</SetLocaleContext>
    </LocaleContext>
  )
}
