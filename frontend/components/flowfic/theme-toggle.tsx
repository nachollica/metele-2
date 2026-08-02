"use client"

import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n"
import { usePreferences } from "@/lib/preferences"

/**
 * Header light/dark toggle. The icon reflects the active theme (sun when light,
 * moon when dark); clicking flips it. Full label shows on `md+`, icon-only on
 * mobile. Disabled until next-themes resolves the theme on the client.
 */
export function ThemeToggle({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations()
  const { theme, setTheme } = usePreferences()
  // `theme` is null until next-themes resolves on the client.
  const mounted = theme !== null
  const isDark = theme === "dark"

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={disabled || !mounted}
      aria-label={t.prefs.modeLabel}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="md:w-auto md:px-3"
    >
      {isDark ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
      <span className="hidden text-sm font-medium md:inline">
        {isDark ? t.prefs.modeDark : t.prefs.modeLight}
      </span>
    </Button>
  )
}
