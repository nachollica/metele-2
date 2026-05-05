// Server-safe i18n configuration.
// These values can be imported by both server and client components.
// NO "use client" directive here.

import { en, type Translations } from "./en"
import { es } from "./es"

export type Locale = "en" | "es"

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "es"] as const

export const DEFAULT_LOCALE: Locale = "en"

const dictionaries: Record<Locale, Translations> = {
  en,
  es,
}

/**
 * Validate and resolve a locale string.
 * Returns the locale if supported, otherwise falls back to the default
 * and logs a warning.
 */
export function resolveLocale(lang: string | undefined): Locale {
  if (lang && SUPPORTED_LOCALES.includes(lang as Locale)) {
    return lang as Locale
  }
  if (lang) {
    console.warn(
      `[i18n] Locale "${lang}" is not supported. Falling back to "${DEFAULT_LOCALE}". ` +
        `Supported locales: ${SUPPORTED_LOCALES.join(", ")}`,
    )
  }
  return DEFAULT_LOCALE
}

/**
 * Get translations for a given locale (non-hook, works on server and client).
 */
export function getTranslations(locale: Locale): Translations {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]
}

export type { Translations }
