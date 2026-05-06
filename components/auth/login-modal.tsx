"use client"

import { useState } from "react"
import { TerminalSquare } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

import { useTranslations } from "@/lib/i18n"
import { AUTH_PROVIDERS, useAuth, type AuthProviderId } from "@/lib/auth"

import { FacebookIcon, GoogleIcon, TwitterIcon } from "./provider-icons"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PROVIDER_ICONS: Record<AuthProviderId, React.ComponentType<{ className?: string }>> = {
  google: GoogleIcon,
  facebook: FacebookIcon,
  twitter: TwitterIcon,
}

// Sentinel "provider" value used to mark the dev-user button as pending.
// Outside of the AUTH_PROVIDERS union so the real provider list stays clean.
const DEV_PENDING = "__dev__"

export function LoginModal({ open, onOpenChange }: Props) {
  const t = useTranslations()
  const { loginWithProvider, loginAsDevUser } = useAuth()
  const [pending, setPending] = useState<AuthProviderId | typeof DEV_PENDING | null>(
    null,
  )
  const [devError, setDevError] = useState<string | null>(null)

  async function handleProvider(provider: AuthProviderId) {
    setPending(provider)
    try {
      await loginWithProvider(provider)
    } catch {
      setPending(null)
    }
  }

  async function handleDevLogin() {
    setPending(DEV_PENDING)
    setDevError(null)
    const ok = await loginAsDevUser()
    if (!ok) {
      setDevError(t.auth.devLoginFailed)
      setPending(null)
      return
    }
    onOpenChange(false)
    setPending(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t.auth.title}</DialogTitle>
          <DialogDescription>{t.auth.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {AUTH_PROVIDERS.map((provider) => {
            const Icon = PROVIDER_ICONS[provider]
            const label = t.auth.continueWith.replace("{provider}", t.auth[provider])
            return (
              <Button
                key={provider}
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3"
                onClick={() => void handleProvider(provider)}
                disabled={pending !== null}
              >
                <Icon className="size-5" />
                <span className="flex-1 text-left">{label}</span>
              </Button>
            )
          })}

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-3 border-dashed"
            onClick={() => void handleDevLogin()}
            disabled={pending !== null}
          >
            <TerminalSquare className="size-5" aria-hidden />
            <span className="flex-1 text-left">
              {t.auth.continueWith.replace("{provider}", t.auth.devUser)}
            </span>
          </Button>
          {devError ? (
            <p className="text-destructive text-xs" role="alert">
              {devError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending !== null}
          >
            {t.auth.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
