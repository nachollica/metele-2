"use client"

// Lightweight i18n facade. Today only English is wired up.
// To add another locale: create e.g. lib/i18n/es.ts with the same shape as en.ts,
// register it in the `dictionaries` map below, and expose a way to switch locales
// (context provider, route segment, etc.) — the hook will pick it up automatically.

import { en, type Translations } from "./en"

type Locale = "en"

const dictionaries: Record<Locale, Translations> = {
  en,
}

const DEFAULT_LOCALE: Locale = "en"

export function useTranslations(locale: Locale = DEFAULT_LOCALE): Translations {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]
}

export type { Translations }
