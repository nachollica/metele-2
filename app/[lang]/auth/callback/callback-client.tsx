"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useLocale, useTranslations } from "@/lib/i18n"
import type { AuthUser } from "@/lib/auth"

type CallbackState =
  | { kind: "loading" }
  | { kind: "error"; message: string }

// The backend redirects here with the issued session in the URL fragment so it
// is never recorded by access logs:
//
//   /<locale>/auth/callback#token=<jwt>&user=<base64url(json)>
//
// On error the backend uses query params instead (`?error=...`) so the user
// sees a friendly message rather than a stuck spinner.
export function CallbackClient() {
  const t = useTranslations()
  const locale = useLocale()
  const { setSession } = useAuth()
  const [state, setState] = useState<CallbackState>({ kind: "loading" })

  useEffect(() => {
    if (typeof window === "undefined") return

    const search = new URLSearchParams(window.location.search)
    const errorParam = search.get("error")
    if (errorParam) {
      setState({ kind: "error", message: errorParam })
      return
    }

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash
    const params = new URLSearchParams(hash)
    const token = params.get("token")
    const userParam = params.get("user")

    if (!token || !userParam) {
      setState({ kind: "error", message: t.auth.signInFailed })
      return
    }

    let user: AuthUser
    try {
      const binary = atob(padBase64Url(userParam))
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
      const json = new TextDecoder().decode(bytes)
      user = JSON.parse(json) as AuthUser
    } catch {
      setState({ kind: "error", message: t.auth.signInFailed })
      return
    }

    setSession(token, user)

    // Strip the fragment so a refresh doesn't replay the same token, then
    // bounce back to the game.
    window.history.replaceState(null, "", `/${locale}/auth/callback`)
    window.location.replace(`/${locale}`)
  }, [locale, setSession, t.auth.signInFailed])

  return (
    <main className="bg-background text-foreground flex min-h-dvh items-center justify-center p-6">
      <div className="bg-card flex max-w-sm flex-col items-center gap-4 rounded-lg border p-6 text-center shadow-sm">
        {state.kind === "loading" ? (
          <>
            <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
            <p className="text-muted-foreground text-sm">{t.auth.finishingSignIn}</p>
          </>
        ) : (
          <>
            <AlertTriangle className="text-destructive size-8" aria-hidden />
            <p className="font-serif text-lg font-semibold">{t.auth.signInFailed}</p>
            <p className="text-muted-foreground text-sm">{state.message}</p>
            <Button asChild variant="outline" size="sm">
              <a href={`/${locale}`}>{t.auth.backToGame}</a>
            </Button>
          </>
        )}
      </div>
    </main>
  )
}

// Pad a base64url string back to base64 length so atob accepts it.
function padBase64Url(input: string): string {
  const replaced = input.replace(/-/g, "+").replace(/_/g, "/")
  const pad = replaced.length % 4
  return pad ? replaced + "=".repeat(4 - pad) : replaced
}
