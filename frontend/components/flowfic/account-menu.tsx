"use client"

import { useState } from "react"
import { BookOpen, ChartLine, LogIn, LogOut, User, UserCog } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Skeleton } from "@/components/ui/skeleton"
import { LoginModal } from "@/components/auth/login-modal"
import { useAuth } from "@/lib/auth"
import { useBackendStatus } from "@/lib/backend"
import { useTranslations } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { FIELD_LABEL } from "@/lib/text-styles"

import { type Section } from "./dashboard-nav"
import { LevelBadge } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"

type Props = {
  /** Open an expanded subsection (My stories / My Progress menu entries). */
  onShowSection?: (section: Section) => void
  /** Invoked from the account menu's "Profile" entry. */
  onOpenProfile?: () => void
  /** Locks the control while a sprint is running. */
  disabled?: boolean
}

/**
 * Account control anchored to the top-right of the app header. Anonymous users
 * get a single "Log in" button (the social login modal doubles as sign-up);
 * signed-in users get their avatar, opening a menu with their name/email, a
 * level badge, quick links into their sections (My stories, My Progress),
 * Profile, and Logout.
 *
 * The dev-user backdoor is intentionally NOT surfaced here — it stays a
 * header-only dev shortcut rendered separately. Like the old control, the whole
 * thing is hidden when the backend is unreachable (there's no offline auth).
 */
export function AccountMenu({ onShowSection, onOpenProfile, disabled = false }: Props) {
  const t = useTranslations()
  const { status, user, logout } = useAuth()
  const { status: backendStatus } = useBackendStatus()
  const { overview } = useGamification()
  const [loginOpen, setLoginOpen] = useState(false)

  // Wait for auth + the first /ping before deciding what to show.
  if (status === "loading" || backendStatus === "unknown") {
    // The shared Skeleton, not a hand-rolled pulse: that one used bg-muted
    // where every other placeholder in the app uses the primitive's bg-accent.
    return <Skeleton className="size-9 rounded-full" aria-hidden />
  }

  // No offline auth: hide the control entirely when the backend is down.
  if (backendStatus === "unreachable") return null

  if (status === "anonymous" || !user) {
    return (
      <>
        {/* 2nd label priority (after the game button): the "Log in" text hides
            on mobile, leaving the icon; it returns from `sm` up. */}
        <Button
          variant="default"
          aria-label={t.auth.logIn}
          className="h-10 gap-2"
          onClick={() => setLoginOpen(true)}
          disabled={disabled}
        >
          <LogIn className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t.auth.logIn}</span>
        </Button>
        <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    )
  }

  const level = overview?.level?.level ?? 1
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    // Non-modal: skips Radix's scroll-lock (react-remove-scroll), which
    // mis-measures the scrollbar gap against our pinned <html> and collapses the
    // layout on mobile. A header menu needs no scroll lock.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {/* Same outline Button shape as the other header controls; the avatar
            sits inside it (circular) with the name on wider screens. */}
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={t.auth.accountMenuLabel}
          className="h-10 gap-2 px-1 sm:pr-3"
        >
          <Avatar className="size-7">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">
              {initials || <User className="size-4" aria-hidden />}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
            {user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cn(FIELD_LABEL, "truncate")}>{user.name}</span>
              {user.email ? (
                <span className="text-muted-foreground truncate text-xs">{user.email}</span>
              ) : null}
            </div>
            <LevelBadge level={level} label={t.dashboard.level} />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onShowSection ? (
          <>
            <DropdownMenuItem onClick={() => onShowSection("stories")}>
              <BookOpen className="size-4" aria-hidden />
              {t.nav.stories}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShowSection("progress")}>
              <ChartLine className="size-4" aria-hidden />
              {t.nav.progress}
            </DropdownMenuItem>
          </>
        ) : null}
        {onOpenProfile ? (
          <DropdownMenuItem onClick={onOpenProfile}>
            <UserCog className="size-4" aria-hidden />
            {t.profile.menuItem}
          </DropdownMenuItem>
        ) : null}
        {/* Logout is the one destructive entry here, so it is fenced off from
            the navigation above it rather than sitting flush with it. */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden />
          {t.auth.logOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
