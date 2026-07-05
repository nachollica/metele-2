// Server-safe i18n configuration.
// These values can be imported by both server and client components.
// NO "use client" directive here.

import { en, type Translations } from "./en"
import { es } from "./es"

export type Locale = "en" | "es"

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "es"] as const

export const DEFAULT_LOCALE: Locale = "es"

const dictionaries: Record<Locale, Translations> = {
  en,
  es,
}

/**
 * Get translations for a given locale (non-hook, works on server and client).
 */
export function getTranslations(locale: Locale): Translations {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]
}

export type { Translations }
