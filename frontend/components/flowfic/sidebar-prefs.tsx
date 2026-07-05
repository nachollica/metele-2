"use client"

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
      {/* Brand mark. The full wordmark fits the sidebar's fixed desktop width
          (and the mobile sheet) at this height, so no responsive icon-only
          swap is needed here; `max-w-full` is a belt-and-braces guard against
          overflow if the container is ever narrower. Plain <img> on purpose —
          the app is a static export with no next/image pipeline. */}
      <h1 className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/flowfic-logo-full.png"
          alt={t.app.title}
          // TODO: HERE — tweak the logo width. `w-2/3` fills ~66% of the
          // sidebar; nudge between roughly `w-2/3` and `w-4/5` to taste.
          // Width-based (with h-auto) so it scales with the sidebar; the
          // height follows the logo's aspect ratio.
          className="h-auto w-2/3 max-w-full"
        />
      </h1>

      {/* Language (left) and light/dark mode (right) share one row, each
          taking half its width. Icons stand in for the text labels. */}
      <div className="grid grid-cols-2 items-center gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Languages
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            <SelectTrigger
              size="sm"
              className="h-8 min-w-0 flex-1"
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

        {/* Single-select toggle group: Radix gives it radiogroup semantics, so
            each option is a radio whose selected state announces the current
            mode (e.g. "Dark, selected"). Setting the theme to the picked value
            (rather than blindly flipping) keeps keyboard/arrow selection and
            the announced state in sync. */}
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
          <ToggleGroupItem
            value="light"
            disabled={!mounted}
            className="gap-1.5 text-xs"
          >
            <Sun className="size-3.5" aria-hidden />
            {t.prefs.modeLight}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            disabled={!mounted}
            className="gap-1.5 text-xs"
          >
            <Moon className="size-3.5" aria-hidden />
            {t.prefs.modeDark}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </section>
  )
}
