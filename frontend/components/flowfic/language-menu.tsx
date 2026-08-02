"use client"

import { Check, Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { SUPPORTED_LOCALES, useTranslations, type Locale } from "@/lib/i18n"
import { usePreferences } from "@/lib/preferences"

// Full label for the trigger (large screens) and every menu row.
const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
}

/**
 * Header language selector. Reuses the Button + DropdownMenu pattern of the
 * account menu so every header control shares one look. The trigger is the
 * languages icon alone on mobile, and the icon plus the selected language's full
 * name on `md+`; the open menu always lists full names with a check on the
 * current one.
 */
export function LanguageMenu({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations()
  const { locale, setLocale } = usePreferences()

  return (
    // Non-modal: avoids Radix's scroll-lock (react-remove-scroll), which
    // mis-measures the scrollbar gap against our pinned <html> and collapses the
    // layout on mobile. A header menu needs no scroll lock.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-lg"
          disabled={disabled}
          aria-label={t.prefs.languageLabel}
          className="md:w-auto md:px-3"
        >
          <Languages className="size-4" aria-hidden />
          <span className="hidden text-sm font-medium md:inline">{LOCALE_LABELS[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {SUPPORTED_LOCALES.map((l) => (
          <DropdownMenuItem key={l} onClick={() => setLocale(l)} className="justify-between">
            {LOCALE_LABELS[l]}
            {l === locale ? <Check className="size-4" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
