"use client"

import { useState } from "react"
import { TerminalSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"

type Props = {
  /** When true the trigger is disabled (e.g. an active game locks the UI). */
  disabled?: boolean
}

// Dev-only shortcut that logs in as a pre-seeded dev user through the backend
// backdoor. It deliberately lives next to the real "Log in" button rather than
// inside the social-login modal, so that modal stays identical across
// environments. Visibility is decided by the caller (AuthButton) based on the
// backend's /ping devUserEnabled flag — the backend also refuses the endpoint
// in production, so this stays dev-only end to end.
export function DevLoginButton({ disabled = false }: Props) {
  const t = useTranslations()
  const { loginAsDevUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const name = username.trim()
    if (!name) return
    setPending(true)
    setError(null)
    const result = await loginAsDevUser(name)
    if (!result.ok) {
      setError(
        result.reason === "not_found"
          ? t.auth.devUserNotFound
          : t.auth.devLoginFailed,
      )
      setPending(false)
      return
    }
    // Success: auth flips to authenticated and AuthButton swaps this whole row
    // for the avatar dropdown. Just tidy up the local popover state.
    setPending(false)
    setUsername("")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t.auth.devUserLogin}
          disabled={disabled}
        >
          <TerminalSquare className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <Input
            type="text"
            autoComplete="off"
            placeholder={t.auth.devUsernamePlaceholder}
            aria-label={t.auth.devUsernameLabel}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending}
          />
          <Button
            type="submit"
            variant="default"
            disabled={pending || username.trim() === ""}
          >
            {t.auth.devLoginSubmit}
          </Button>
          {error ? (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </PopoverContent>
    </Popover>
  )
}
