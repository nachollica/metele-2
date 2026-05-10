"use client"

import { Moon, Sun } from "lucide-react"

import { Label } from "@/components/ui/label"
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

// Match the SelectTrigger size="sm" (h-8) + w-32 below so both controls
// sit at the same dimensions.
const CONTROL_CLASS = "h-8 w-32"

export function SidebarPrefs() {
  const t = useTranslations()
  const { theme, setTheme, locale, setLocale } = usePreferences()
  // `theme` is null until next-themes resolves on the client; render the
  // toggle in a neutral state until then so the server/first-render HTML
  // doesn't disagree with the post-hydration value.
  const mounted = theme !== null

  return (
    <section
      aria-label={t.prefs.sectionLabel}
      className="flex flex-col gap-3 border-b p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="prefs-mode-light" className="text-sm font-medium">
          {t.prefs.modeLabel}
        </Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={mounted ? theme : ""}
          onValueChange={() => {
            if (!mounted) return
            setTheme(theme === "dark" ? "light" : "dark")
          }}
          aria-label={t.prefs.modeLabel}
          className={CONTROL_CLASS}
        >
          <ToggleGroupItem
            id="prefs-mode-light"
            value="light"
            aria-label={t.theme.switchToLight}
            disabled={!mounted}
            className="gap-1.5 text-xs"
          >
            <Sun className="size-3.5" aria-hidden />
            {t.prefs.modeLight}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            aria-label={t.theme.switchToDark}
            disabled={!mounted}
            className="gap-1.5 text-xs"
          >
            <Moon className="size-3.5" aria-hidden />
            {t.prefs.modeDark}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="prefs-lang-select" className="text-sm font-medium">
          {t.prefs.languageLabel}
        </Label>
        <Select
          value={locale}
          onValueChange={(v) => setLocale(v as Locale)}
        >
          <SelectTrigger
            id="prefs-lang-select"
            size="sm"
            className={CONTROL_CLASS}
            aria-label={t.prefs.languageLabel}
          >
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
    </section>
  )
}
