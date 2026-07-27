"use client"

// Language + light/dark controls for the sidebar footer, stacked full-width so
// each spans the panel. (The brand logo that used to sit above these now lives
// in the sidebar header; login/profile moved to the top-right header.)

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
    <div className="flex flex-col gap-2">
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
        <ToggleGroupItem value="light" disabled={!mounted} className="flex-1 gap-1.5 text-xs">
          <Sun className="size-3.5" aria-hidden />
          {t.prefs.modeLight}
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" disabled={!mounted} className="flex-1 gap-1.5 text-xs">
          <Moon className="size-3.5" aria-hidden />
          {t.prefs.modeDark}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
