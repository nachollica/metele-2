"use client"

import { useEffect, useState } from "react"
import { LogIn, LogOut, User, UserCog } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useAuth } from "@/lib/auth"
import { useBackendStatus } from "@/lib/backend"
import { useTranslations } from "@/lib/i18n"

import { DevLoginButton } from "./dev-login-button"
import { LoginModal } from "./login-modal"

type Props = {
  /** Optional handler invoked when the user picks "Profile" in the avatar
   *  dropdown. When omitted, the dropdown only shows logout. */
  onOpenProfile?: () => void
  /** When true, both the anonymous "Log in" CTA and the authenticated avatar
   *  dropdown are disabled. Used to lock UI during an active session. */
  disabled?: boolean
}

// Single header-bar control. While loading we render a placeholder skeleton
// so the row doesn't layout-shift once the AuthContext settles.
export function AuthButton({ onOpenProfile, disabled = false }: Props = {}) {
  const t = useTranslations()
  const { status, user, logout } = useAuth()
  const { status: backendStatus, devUserEnabled } = useBackendStatus()
  const [loginOpen, setLoginOpen] = useState(false)
  // The Auth0 SDK + the dev session both depend on localStorage, which
  // doesn't exist during SSR. Defer the auth-aware render to a post-mount
  // effect so the server-rendered HTML always matches the first client
  // tick (skeleton). Avoids the hydration mismatch when the user lands
  // already-authenticated.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Skeleton until everything that decides what to show has settled: the
  // post-mount tick, the auth status, and the first /ping result.
  if (!mounted || status === "loading" || backendStatus === "unknown") {
    return <div className="bg-muted h-9 w-24 animate-pulse rounded-md" aria-hidden />
  }

  // Backend unreachable: hide the auth control entirely. This also hides the
  // avatar mid-session if the backend disappears — the rest of the app keeps
  // working, but nothing auth-related is actionable without the backend.
  if (backendStatus === "unreachable") {
    return null
  }

  if (status === "anonymous" || !user) {
    return (
      <>
        <div className="flex items-center gap-2">
          {/* Dev-only shortcut, left of the real CTA. Shown only while
              anonymous and only when the backend reports the dev backdoor on. */}
          {devUserEnabled ? <DevLoginButton disabled={disabled} /> : null}
          <Button
            variant="default"
            size="sm"
            onClick={() => setLoginOpen(true)}
            disabled={disabled}
          >
            <LogIn className="size-4" aria-hidden />
            {t.auth.logIn}
          </Button>
        </div>
        <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    )
  }

  // Guardrail for the upcoming inter-user features (story publishing,
  // interactions): only the display name is ever shown as the primary
  // user-facing label, and it is the only field the public profile will
  // expose. The email is rendered ONLY in the dropdown that belongs to the
  // owner themselves — never anywhere a third party can see. Keep the
  // selection logic here so the leak surface stays small.
  const displayLabel = user.name
  const initials = displayLabel
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 px-2"
          aria-label={t.auth.accountMenuLabel}
          disabled={disabled}
        >
          <Avatar className="size-7">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="text-xs">
              {initials || <User className="size-4" aria-hidden />}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:inline">
            {displayLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold truncate">{displayLabel}</span>
            {/*
              The email is intentionally rendered only inside the owner's own
              dropdown (smaller text, secondary line) so future inter-user
              features never accidentally leak it. Display name is the only
              identifier visible to third parties.
            */}
            {user.email ? (
              <span className="text-muted-foreground truncate text-xs">
                {user.email}
              </span>
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
  )
}
