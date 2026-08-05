"use client"

import { DevLoginButton } from "@/components/auth/dev-login-button"
import { useTranslations } from "@/lib/i18n"
import type { AuthContextValue } from "@/lib/auth"

import { AccountMenu } from "./account-menu"
import { type Section } from "./dashboard-nav"
import { LanguageMenu } from "./language-menu"
import { ThemeToggle } from "./theme-toggle"

type Props = {
  authStatus: AuthContextValue["status"]
  /** Whether the backend advertises the dev-user backdoor. */
  devUserEnabled: boolean
  /** Locks the controls while a sprint is running / words are loading. */
  disabled: boolean
  /** Return to the landing dashboard (brand logo acts as a home link). */
  onGoHome: () => void
  /** Open an expanded subsection (from the account-menu links). */
  onShowSection: (section: Section) => void
  onOpenProfile: () => void
}

/**
 * The topmost app bar, same structure on every screen. Left: brand logo (a home
 * link) with the language + light/dark controls beside it. Right: the dev-login
 * shortcut and the account control (Log in / avatar).
 *
 * There is deliberately no game action here — the whole session lifecycle is
 * driven from the home screen's launcher and, mid-sprint, from the pause/quit
 * controls inside the game HUD.
 */
export function AppHeader({
  authStatus,
  devUserEnabled,
  disabled,
  onGoHome,
  onShowSection,
  onOpenProfile,
}: Props) {
  const t = useTranslations()
  return (
    // The full brand mark needs vertical room on wider screens, so the bar
    // grows there (buttons stay centered in the extra space); on mobile it
    // stays compact with just the icon so nothing is wasted.
    <header className="bg-card/60 flex items-center justify-between gap-3 border-b px-4 py-2 sm:px-6 md:py-4">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        {/* Brand, far-left — doubles as a home link (locked during play).
            Icon-only on mobile, full logo + wordmark from md up. */}
        <button
          type="button"
          onClick={onGoHome}
          disabled={disabled}
          aria-label={t.app.title}
          className="focus-visible:ring-ring/50 shrink-0 rounded-md transition-opacity focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/flowfic-logo.png" alt="" aria-hidden className="size-9 object-contain md:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/flowfic-logo-full.png"
            alt=""
            aria-hidden
            className="hidden h-[5.5rem] w-auto object-contain md:block"
          />
        </button>
        {/* Language + light/dark sit next to the logo: full on desktop, square
            icons on mobile. */}
        <LanguageMenu disabled={disabled} />
        <ThemeToggle disabled={disabled} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Dev-user backdoor: header-only shortcut, anonymous + backend-enabled. */}
        {authStatus === "anonymous" && devUserEnabled ? (
          <DevLoginButton disabled={disabled} />
        ) : null}
        <AccountMenu onShowSection={onShowSection} onOpenProfile={onOpenProfile} disabled={disabled} />
      </div>
    </header>
  )
}
