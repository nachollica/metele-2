"use client"

import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n"
import { usePreferences } from "@/lib/preferences"

/**
 * Header light/dark toggle. The icon reflects the active theme (sun when light,
 * moon when dark); clicking flips it. Icon-only at every width — the accessible
 * name carries the meaning instead, and names the *destination* theme since a
 * bare "Mode" says nothing once the visible label is gone. Disabled until
 * next-themes resolves the theme on the client.
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
      size="icon-lg"
      disabled={disabled || !mounted}
      aria-label={isDark ? t.prefs.modeSwitchToLight : t.prefs.modeSwitchToDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
    </Button>
  )
}
