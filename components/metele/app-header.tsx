"use client"

import { type ReactNode } from "react"

import { AuthButton } from "@/components/auth/auth-button"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Fixed width chosen so the longest localized label ("Empezar a escribir",
// "Salir de sesión", "Empezar de nuevo") fits with its icon without wrapping.
// Shared across every screen so the action slot doesn't shift between settings
// and the game area.
export const PRIMARY_ACTION_CLASS = "w-44 justify-center"

type Props = {
  /** Primary action for the current screen (Start / Quit / Start again). */
  action?: ReactNode
}

/**
 * Top-of-screen card rendered identically on every screen of the app. Holds
 * the app title on the left and the primary action + auth control on the
 * right. By using one component everywhere, the auth button stays anchored to
 * the same pixel as the user moves between screens.
 */
export function AppHeader({ action }: Props) {
  const t = useTranslations()
  return (
    <header className="bg-card text-card-foreground flex items-center justify-between gap-3 rounded-lg border p-4 shadow-sm">
      <h1 className="font-serif text-xl font-semibold tracking-tight">
        {t.app.title}
      </h1>
      <div className="flex items-center gap-2">
        {action}
        <AuthButton />
      </div>
    </header>
  )
}

type ActionProps = {
  icon: ReactNode
  label: string
  onClick: () => void
}

/**
 * Button used in the AppHeader's action slot. All instances share variant,
 * size and width so the slot looks identical regardless of which screen
 * supplies the label/icon.
 */
export function PrimaryActionButton({ icon, label, onClick }: ActionProps) {
  return (
    <Button onClick={onClick} size="sm" className={cn(PRIMARY_ACTION_CLASS)}>
      {icon}
      {label}
    </Button>
  )
}
