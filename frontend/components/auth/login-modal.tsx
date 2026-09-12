"use client"

import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import { useTranslations, type Translations } from "@/lib/i18n"
import { OVERLINE } from "@/lib/text-styles"
import {
  AUTH_PROVIDERS,
  useAuth,
  type AuthProviderId,
} from "@/lib/auth"

import { GoogleIcon } from "./provider-icons"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PROVIDER_ICONS: Record<AuthProviderId, React.ComponentType<{ className?: string }>> = {
  google: GoogleIcon,
}

// Social-login only. The dev-user backdoor used to live here as a collapsible
// row, but it now sits beside the header's "Log in" button (see
// DevLoginButton) so this modal stays identical across environments.
export function LoginModal({ open, onOpenChange }: Props) {
  const t = useTranslations()
  const { loginWithProvider } = useAuth()
  const [pending, setPending] = useState<AuthProviderId | null>(null)

  async function handleProvider(provider: AuthProviderId) {
    setPending(provider)
    try {
      await loginWithProvider(provider)
    } catch {
      setPending(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t.auth.title}</DialogTitle>
          <DialogDescription>{t.auth.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <DividerWithLabel>{t.auth.providersDivider}</DividerWithLabel>
          <SocialProviderButtons t={t} pending={pending} onProvider={handleProvider} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SocialProviderButtons({
  t,
  pending,
  onProvider,
}: {
  t: Translations
  pending: AuthProviderId | null
  onProvider: (provider: AuthProviderId) => void
}) {
  return (
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
            onClick={() => onProvider(provider)}
            disabled={pending !== null}
          >
            <Icon className="size-5" />
            <span className="flex-1 text-left">{label}</span>
          </Button>
        )
      })}
    </div>
  )
}

function DividerWithLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <Separator className="flex-1" />
      <span className={OVERLINE}>
        {children}
      </span>
      <Separator className="flex-1" />
    </div>
  )
}
