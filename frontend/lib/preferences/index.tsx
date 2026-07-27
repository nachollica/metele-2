"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useTheme } from "next-themes"

import { useAuth } from "@/lib/auth"
import {
  SUPPORTED_LOCALES,
  useLocale,
  useSetLocale,
  type Locale,
} from "@/lib/i18n"
import { detectLocale } from "@/lib/i18n/locale-provider"
import type { SoundMode } from "@/lib/flowfic/types"

export type ThemeMode = "light" | "dark"

export type StoredPrefs = {
  theme?: ThemeMode
  locale?: Locale
  soundEnabled?: boolean
  soundMode?: SoundMode
}

// Per-user settings live in localStorage so they don't follow the user
// across browsers; the key is namespaced by the active user id (or
// "anonymous" when signed out) so two people sharing one browser keep
// their own choices.
const STORAGE_PREFIX = "flowfic.prefs."

export function storageKey(userId: string | null): string {
  return `${STORAGE_PREFIX}${userId ?? "anonymous"}`
}

/** Reads + validates stored preferences for a user, migrating legacy keys.
 *  Exported for unit tests; app code goes through the provider. */
export function readPrefs(userId: string | null): StoredPrefs {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: StoredPrefs = {}
    if (parsed.theme === "light" || parsed.theme === "dark") {
      out.theme = parsed.theme
    }
    if (
      typeof parsed.locale === "string" &&
      (SUPPORTED_LOCALES as readonly string[]).includes(parsed.locale)
    ) {
      out.locale = parsed.locale as Locale
    }
    // Word sound. New shape: `soundEnabled` (bool) + `soundMode` ("bell" |
    // "speak"). Legacy shape: a lone boolean `bellEnabled`. Migrate the old
    // key when the new one is absent so pre-existing users keep their choice.
    if (typeof parsed.soundEnabled === "boolean") {
      out.soundEnabled = parsed.soundEnabled
    } else if (typeof parsed.bellEnabled === "boolean") {
      out.soundEnabled = parsed.bellEnabled
    }
    if (parsed.soundMode === "bell" || parsed.soundMode === "speak") {
      out.soundMode = parsed.soundMode
    }
    return out
  } catch {
    return {}
  }
}

function writePrefs(userId: string | null, patch: StoredPrefs) {
  if (typeof window === "undefined") return
  try {
    const current = readPrefs(userId)
    const next = { ...current, ...patch }
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next))
  } catch {
    // localStorage unavailable / quota exceeded — pref is in-memory only.
  }
}

type PreferencesContextValue = {
  // Resolved theme as reported by next-themes. `null` until the provider
  // mounts on the client (next-themes resolves theme post-hydration).
  theme: ThemeMode | null
  setTheme: (mode: ThemeMode) => void
  locale: Locale
  setLocale: (locale: Locale) => void
  // `null` while preferences are still hydrating; consumers should fall
  // back to their own default until then.
  soundEnabled: boolean | null
  setSoundEnabled: (enabled: boolean) => void
  soundMode: SoundMode | null
  setSoundMode: (mode: SoundMode) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error("usePreferences must be used inside <PreferencesProvider>")
  }
  return ctx
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { resolvedTheme, setTheme: setNextTheme } = useTheme()
  const locale = useLocale()
  const setCtxLocale = useSetLocale()
  const [soundEnabled, setSoundEnabledState] = useState<boolean | null>(null)
  const [soundMode, setSoundModeState] = useState<SoundMode | null>(null)

  // Hydrate stored prefs for the active user and push them into the
  // owning providers. Re-runs whenever the active user changes (login,
  // logout, dev-user switch) so the sidebar instantly reflects the new
  // user's saved choices.
  useEffect(() => {
    const stored = readPrefs(userId)
    // Falling back to browser defaults (system theme, navigator-detected
    // locale) on every user change ensures that signing out doesn't leave
    // the previous user's theme/locale stuck in place when the anonymous
    // bucket has nothing stored.
    setNextTheme(stored.theme ?? "system")
    setCtxLocale(stored.locale ?? detectLocale())
    setSoundEnabledState(stored.soundEnabled ?? null)
    setSoundModeState(stored.soundMode ?? null)
  }, [userId, setNextTheme, setCtxLocale])

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setNextTheme(mode)
      writePrefs(userId, { theme: mode })
    },
    [setNextTheme, userId],
  )

  const setLocale = useCallback(
    (next: Locale) => {
      setCtxLocale(next)
      writePrefs(userId, { locale: next })
    },
    [setCtxLocale, userId],
  )

  const setSoundEnabled = useCallback(
    (enabled: boolean) => {
      setSoundEnabledState(enabled)
      writePrefs(userId, { soundEnabled: enabled })
    },
    [userId],
  )

  const setSoundMode = useCallback(
    (mode: SoundMode) => {
      setSoundModeState(mode)
      writePrefs(userId, { soundMode: mode })
    },
    [userId],
  )

  const themeValue: ThemeMode | null =
    resolvedTheme === "dark" || resolvedTheme === "light"
      ? resolvedTheme
      : null

  const value = useMemo<PreferencesContextValue>(
    () => ({
      theme: themeValue,
      setTheme,
      locale,
      setLocale,
      soundEnabled,
      setSoundEnabled,
      soundMode,
      setSoundMode,
    }),
    [
      themeValue,
      setTheme,
      locale,
      setLocale,
      soundEnabled,
      setSoundEnabled,
      soundMode,
      setSoundMode,
    ],
  )

  return <PreferencesContext value={value}>{children}</PreferencesContext>
}
