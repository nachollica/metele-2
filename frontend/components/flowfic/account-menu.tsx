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
import { useTranslations } from "@/lib/i18n"

import { useGamification } from "./gamification-context"

type Props = {
  /** Invoked from the account menu's "Profile" entry. */
  onOpenProfile?: () => void
  /** Locks the control while a sprint is running. */
  disabled?: boolean
}

/**
 * Account control anchored to the top-right of the app header. Anonymous users
 * get a single "Log in" button (the social login modal doubles as sign-up);
 * signed-in users get their avatar, opening a menu with their name/email, a
 * level badge, Profile, and Logout.
 *
 * The dev-user backdoor is intentionally NOT surfaced here — it stays a
 * header-only dev shortcut rendered separately. Like the old control, the whole
 * thing is hidden when the backend is unreachable (there's no offline auth).
 */
export function AccountMenu({ onOpenProfile, disabled = false }: Props) {
  const t = useTranslations()
  const { status, user, logout } = useAuth()
  const { status: backendStatus } = useBackendStatus()
  const { overview } = useGamification()
  const [loginOpen, setLoginOpen] = useState(false)

  // Wait for auth + the first /ping before deciding what to show.
  if (status === "loading" || backendStatus === "unknown") {
    return <div className="bg-muted size-9 animate-pulse rounded-full" aria-hidden />
  }

  // No offline auth: hide the control entirely when the backend is down.
  if (backendStatus === "unreachable") return null

  if (status === "anonymous" || !user) {
    return (
      <>
        <Button
          variant="default"
          size="sm"
          className="gap-2"
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

  const level = overview?.level?.level ?? 1
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          aria-label={t.auth.accountMenuLabel}
          className="focus-visible:ring-ring/50 hover:bg-accent flex items-center gap-2 rounded-full py-0.5 pr-3 pl-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        >
          <Avatar className="size-9">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">
              {initials || <User className="size-4" aria-hidden />}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
            {user.name}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span className="truncate text-sm font-semibold">{user.name}</span>
            {user.email ? (
              <span className="text-muted-foreground truncate text-xs">{user.email}</span>
            ) : null}
            <span className="bg-primary/10 text-primary mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-semibold">
              {t.dashboard.level} {level}
            </span>
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
  )
}
