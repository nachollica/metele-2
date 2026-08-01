"use client"

import { type ReactNode } from "react"

import { DevLoginButton } from "@/components/auth/dev-login-button"
import { useTranslations } from "@/lib/i18n"
import type { AuthContextValue } from "@/lib/auth"

import { AccountMenu } from "./account-menu"
import { PrefsMenu } from "./prefs-menu"

type Props = {
  /** Game action for the top-left slot (New story / Start writing / Quit …). */
  primaryAction: ReactNode
  authStatus: AuthContextValue["status"]
  /** Whether the backend advertises the dev-user backdoor. */
  devUserEnabled: boolean
  /** Locks the controls while a sprint is running / words are loading. */
  disabled: boolean
  /** Return to the landing dashboard (brand logo acts as a home link). */
  onGoHome: () => void
  onOpenProfile: () => void
}

/**
 * The topmost app bar, unchanged in structure across every screen: brand logo
 * far-left, the primary game action beside it, and the account + preferences
 * controls far-right. (The brand + preferences moved here from the removed
 * sidebar.)
 */
export function AppHeader({
  primaryAction,
  authStatus,
  devUserEnabled,
  disabled,
  onGoHome,
  onOpenProfile,
}: Props) {
  const t = useTranslations()
  return (
    // The full brand mark needs vertical room on wider screens, so the bar
    // grows there (buttons stay centered in the extra space); on mobile it
    // stays compact with just the icon so nothing is wasted.
    <header className="bg-card/60 flex items-center justify-between gap-3 border-b px-4 py-2 sm:px-6 md:py-4">
      <div className="flex min-w-0 items-center gap-3 md:gap-8">
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
        {/* Primary action (New story / Start writing / Quit …). */}
        {primaryAction}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PrefsMenu disabled={disabled} />
        {/* Dev-user backdoor: header-only shortcut, anonymous + backend-enabled. */}
        {authStatus === "anonymous" && devUserEnabled ? (
          <DevLoginButton disabled={disabled} />
        ) : null}
        <AccountMenu onOpenProfile={onOpenProfile} disabled={disabled} />
      </div>
    </header>
  )
}
