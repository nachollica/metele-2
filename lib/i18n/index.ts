"use client"

// Client-side i18n hooks. Re-exports the server-safe types and
// constants, and adds React context + hooks for components.

import { createContext, useContext } from "react"

import { type Locale, type Translations, DEFAULT_LOCALE, getTranslations } from "./config"

// Re-export everything from config so consumers only need one import
export { DEFAULT_LOCALE, SUPPORTED_LOCALES, resolveLocale, getTranslations } from "./config"
export type { Locale, Translations } from "./config"

// ---- React context --------------------------------------------------------

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

// Setter exposed by `LocaleProvider` so other providers (e.g. the
// per-user preferences store) can drive the active locale without each
// consumer wiring its own state.
export const SetLocaleContext = createContext<(locale: Locale) => void>(
  () => {},
)

/**
 * Read the current locale from context, typically provided by the
 * `[lang]/layout.tsx` locale provider.
 */
export function useLocale(): Locale {
  return useContext(LocaleContext)
}

/** Setter counterpart to `useLocale`. */
export function useSetLocale(): (locale: Locale) => void {
  return useContext(SetLocaleContext)
}

/**
 * Grab the full translations object for the current locale.
 * Locale is read from context; no argument needed in components.
 */
export function useTranslations(): Translations {
  const locale = useLocale()
  return getTranslations(locale)
}
