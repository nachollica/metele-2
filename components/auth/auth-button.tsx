"use client"

import { useState } from "react"
import { LogIn, LogOut, User } from "lucide-react"

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
import { useTranslations } from "@/lib/i18n"

import { LoginModal } from "./login-modal"

// Single header-bar control. While loading we render a placeholder skeleton
// so the row doesn't layout-shift once the AuthContext settles.
export function AuthButton() {
  const t = useTranslations()
  const { status, user, logout } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)

  if (status === "loading") {
    return <div className="bg-muted h-9 w-24 animate-pulse rounded-md" aria-hidden />
  }

  if (status === "anonymous" || !user) {
    return (
      <>
        <Button variant="default" size="sm" onClick={() => setLoginOpen(true)}>
          <LogIn className="size-4" aria-hidden />
          {t.auth.logIn}
        </Button>
        <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    )
  }

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 px-2"
          aria-label={t.auth.accountMenuLabel}
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
            {user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{user.name}</span>
            {user.email ? (
              <span className="text-muted-foreground truncate text-xs">{user.email}</span>
            ) : null}
            <span className="text-muted-foreground text-xs">
              {t.auth.profileProvider.replace("{provider}", t.auth[user.provider])}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden />
          {t.auth.logOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
