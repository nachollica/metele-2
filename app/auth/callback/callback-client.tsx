"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n"

// Auth0Provider's `onRedirectCallback` runs as soon as the SDK finishes the
// code+state exchange and pushes the user back to the configured returnTo
// path, so this page is normally only rendered for a brief moment. If Auth0
// returns an error in the query string (`?error=...`) we surface it here
// instead of leaving the user staring at the spinner forever.
export function CallbackClient() {
  const t = useTranslations()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const search = new URLSearchParams(window.location.search)
    const errorParam = search.get("error_description") ?? search.get("error")
    if (errorParam) setError(errorParam)
  }, [])

  return (
    <main className="bg-background text-foreground flex min-h-dvh items-center justify-center p-6">
      <div className="bg-card flex max-w-sm flex-col items-center gap-4 rounded-lg border p-6 text-center shadow-sm">
        {error === null ? (
          <>
            <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
            <p className="text-muted-foreground text-sm">{t.auth.finishingSignIn}</p>
          </>
        ) : (
          <>
            <AlertTriangle className="text-destructive size-8" aria-hidden />
            <p className="font-serif text-lg font-semibold">{t.auth.signInFailed}</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/">{t.auth.backToGame}</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
