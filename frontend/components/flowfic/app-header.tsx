"use client"

import { ArrowLeft } from "lucide-react"

import { DevLoginButton } from "@/components/auth/dev-login-button"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SCREEN_TITLE } from "@/lib/text-styles"
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
  /** Screen title for the centre column; `null` mid-sprint (the HUD owns the
   *  session's context, so the bar stays empty there). */
  title: string | null
  /** Back arrow beside the title. Omitted on the landing, which is the root. */
  onBack?: () => void
  backLabel?: string | null
  /** Return to the landing dashboard (brand logo acts as a home link). */
  onGoHome: () => void
  /** Open an expanded subsection (from the account-menu links). */
  onShowSection: (section: Section) => void
  onOpenProfile: () => void
}

/**
 * The topmost app bar, same structure on every screen. Three columns: the
 * light/dark toggle and the brand logo (a home link) on the left, the screen
 * title with its back arrow in the centre, and the language + account controls
 * on the right.
 *
 * The centre column is laid out as `1fr auto 1fr` rather than as a flex row, so
 * the title is centred against the viewport instead of merely sitting between
 * two clusters of different widths.
 *
 * There is deliberately no game action here — the whole session lifecycle is
 * driven from the home screen's launcher and, mid-sprint, from the pause/quit
 * controls inside the game HUD. The light/dark toggle is the one control that
 * stays live during a sprint: flipping the theme never touches the session.
 */
export function AppHeader({
  authStatus,
  devUserEnabled,
  disabled,
  title,
  onBack,
  backLabel,
  onGoHome,
  onShowSection,
  onOpenProfile,
}: Props) {
  const t = useTranslations()
  return (
    <header className="bg-card/60 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4 py-2 sm:px-6">
      {/* `min-w-max` pins the side cell to its content: a `1fr` track would
          otherwise let its flex children compress, sliding the logo under the
          title on a narrow bar. Squeezed space comes out of the title instead
          (its own `min-w-0` below). */}
      <div className="flex min-w-max items-center gap-2 md:gap-3">
        <ThemeToggle />
        {/* Brand — doubles as a home link (locked during play). Icon-only on
            mobile, full logo + wordmark from md up. */}
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
            className="hidden h-[4.125rem] w-auto object-contain md:block"
          />
        </button>
      </div>

      {/* Screen title. The back arrow lives here too, so every screen's "up"
          affordance sits in one fixed place instead of at the top of its own
          content. Empty (but still a grid cell) during a sprint. */}
      <div className="flex min-w-0 items-center justify-center gap-1">
        {title !== null && onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label={backLabel ?? t.nav.backToHome}
            className="shrink-0"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
        ) : null}
        {/* `min-w-0` so a long title gives way to the side clusters instead of
            pushing them off the bar on a narrow screen — it truncates
            visually, and assistive tech still reads the whole heading. */}
        {title !== null ? (
          <h1 className={cn(SCREEN_TITLE, "min-w-0 truncate")}>{title}</h1>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        {/* Dev-user backdoor: header-only shortcut, anonymous + backend-enabled. */}
        {authStatus === "anonymous" && devUserEnabled ? (
          <DevLoginButton disabled={disabled} />
        ) : null}
        <LanguageMenu disabled={disabled} />
        <AccountMenu onShowSection={onShowSection} onOpenProfile={onOpenProfile} disabled={disabled} />
      </div>
    </header>
  )
}
