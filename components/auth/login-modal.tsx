"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import { useLocale, useTranslations } from "@/lib/i18n"
import { startProviderLogin, type AuthProviderId } from "@/lib/auth"

import { FacebookIcon, GoogleIcon, InstagramIcon } from "./provider-icons"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Show the "Try mock account" shortcut. We expose it on dev/staging so the
  // end-to-end flow can be exercised without real OAuth credentials.
  showMock?: boolean
}

const PROVIDER_ICONS: Record<AuthProviderId, React.ComponentType<{ className?: string }>> = {
  google: GoogleIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
}

const PROVIDER_ORDER: AuthProviderId[] = ["google", "instagram", "facebook"]

export function LoginModal({ open, onOpenChange, showMock = true }: Props) {
  const t = useTranslations()
  const locale = useLocale()

  function handleProvider(provider: AuthProviderId, mock = false) {
    startProviderLogin(provider, locale, { mock })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t.auth.title}</DialogTitle>
          <DialogDescription>{t.auth.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {PROVIDER_ORDER.map((provider) => {
            const Icon = PROVIDER_ICONS[provider]
            const label = t.auth.continueWith.replace("{provider}", t.auth[provider])
            return (
              <Button
                key={provider}
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3"
                onClick={() => handleProvider(provider, false)}
              >
                <Icon className="size-5" />
                <span className="flex-1 text-left">{label}</span>
              </Button>
            )
          })}
        </div>

        {showMock ? (
          <>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs uppercase tracking-widest">
                {t.auth.or}
              </span>
              <Separator className="flex-1" />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleProvider("google", true)}
            >
              {t.auth.tryMock}
            </Button>
          </>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.auth.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
