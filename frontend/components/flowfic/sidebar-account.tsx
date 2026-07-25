"use client"

import { useState } from "react"
import { LogIn, LogOut, User, UserCog } from "lucide-react"

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

import { LoginModal } from "@/components/auth/login-modal"
import { useAuth } from "@/lib/auth"
import { useBackendStatus } from "@/lib/backend"
import { useLocale, useTranslations } from "@/lib/i18n"
import { formatCount } from "@/lib/flowfic/gamification"

import { ProgressMeter } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"

type Props = {
  /** Invoked from the account menu's "Profile" entry. */
  onOpenProfile?: () => void
  /** Locks the control while a sprint is running. */
  disabled?: boolean
}

/**
 * Account control that lives in the sidebar footer, beside the language and
 * theme toggles. Anonymous users get a single "Log in" button (the social
 * login modal doubles as sign-up); signed-in users get their avatar + name +
 * level, opening a menu with Profile and Logout.
 *
 * The dev-user backdoor is intentionally NOT surfaced here — it stays a
 * header-only dev shortcut. Like the old header control, the whole thing is
 * hidden when the backend is unreachable (there's no offline auth).
 */
export function SidebarAccount({ onOpenProfile, disabled = false }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const { status, user, logout } = useAuth()
  const { status: backendStatus } = useBackendStatus()
  const { overview } = useGamification()
  const [loginOpen, setLoginOpen] = useState(false)

  // Wait for auth + the first /ping before deciding what to show.
  if (status === "loading" || backendStatus === "unknown") {
    return <div className="bg-muted h-10 animate-pulse rounded-xl" aria-hidden />
  }

  // No offline auth: hide the control entirely when the backend is down.
  if (backendStatus === "unreachable") return null

  if (status === "anonymous" || !user) {
    return (
      <>
        <Button
          variant="default"
          className="w-full justify-center gap-2"
          onClick={() => setLoginOpen(true)}
          disabled={disabled}
        >
          <LogIn className="size-4" aria-hidden />
          {t.auth.logIn}
        </Button>
        <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    )
  }

  const level = overview?.level
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="bg-primary/5 flex flex-col gap-2 rounded-2xl p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            disabled={disabled}
            aria-label={t.auth.accountMenuLabel}
            className="focus-visible:ring-ring/50 -m-1 flex items-center gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60 dark:hover:bg-white/5"
          >
            <Avatar className="size-9">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-xs">
                {initials || <User className="size-4" aria-hidden />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="text-primary text-xs font-medium">
                {t.dashboard.level} {level?.level ?? 1}
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-semibold">{user.name}</span>
              {user.email ? (
                <span className="text-muted-foreground truncate text-xs">{user.email}</span>
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {onOpenProfile ? (
            <DropdownMenuItem onClick={onOpenProfile}>
              <UserCog className="size-4" aria-hidden />
              {t.profile.menuItem}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => void logout()}>
            <LogOut className="size-4" aria-hidden />
            {t.auth.logOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProgressMeter
        value={level ? level.xpIntoLevel / Math.max(1, level.xpForLevel) : 0}
        label={t.dashboard.xpLabel}
      />
      <div className="text-muted-foreground text-xs tabular-nums">
        {formatCount(level?.xpIntoLevel ?? 0, locale)} /{" "}
        {formatCount(level?.xpForLevel ?? 0, locale)} {t.dashboard.xp}
      </div>
    </div>
  )
}
