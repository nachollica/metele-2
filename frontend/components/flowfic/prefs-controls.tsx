"use client"

// Language + light/dark controls, extracted so both the dashboard sidebar and
// the settings section can drop them in. (The brand logo that used to sit above
// these now lives in the sidebar header.)

import { Languages, Moon, Sun } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { SUPPORTED_LOCALES, useTranslations, type Locale } from "@/lib/i18n"
import { usePreferences } from "@/lib/preferences"

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
}

export function PrefsControls() {
  const t = useTranslations()
  const { theme, setTheme, locale, setLocale } = usePreferences()
  // `theme` is null until next-themes resolves on the client.
  const mounted = theme !== null

  return (
    <div className="grid grid-cols-2 items-center gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Languages className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
          <SelectTrigger size="sm" className="h-8 min-w-0 flex-1" aria-label={t.prefs.languageLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LOCALES.map((l) => (
              <SelectItem key={l} value={l}>
                {LOCALE_LABELS[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={mounted ? theme : ""}
        onValueChange={(value) => {
          if (!mounted || value === "") return
          setTheme(value as "light" | "dark")
        }}
        aria-label={t.prefs.modeLabel}
        className="h-8 w-full"
      >
        <ToggleGroupItem value="light" disabled={!mounted} className="gap-1.5 text-xs">
          <Sun className="size-3.5" aria-hidden />
          {t.prefs.modeLight}
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" disabled={!mounted} className="gap-1.5 text-xs">
          <Moon className="size-3.5" aria-hidden />
          {t.prefs.modeDark}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
