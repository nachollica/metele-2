"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

import { useTranslations } from "@/lib/i18n"

// Splash shown while the Dashboard chunk downloads. Because the whole game is
// `dynamic(ssr:false)`, the static HTML ships as an empty shell — without this
// fallback the user stares at a blank page until the JS lands. `aria-busy` +
// the live status text keep the wait legible to assistive tech.
function GameShellFallback() {
  const t = useTranslations()
  return (
    <div
      className="bg-background text-foreground flex h-dvh flex-col items-center justify-center gap-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Plain <img>: the app is a static export. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/flowfic-logo.png"
        alt=""
        aria-hidden
        className="size-24 object-contain"
      />
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="text-primary size-4 animate-spin" aria-hidden />
        <span>{t.app.loading}</span>
      </div>
    </div>
  )
}

// Skip SSR for the whole game tree. Auth state lives in localStorage
// (Auth0 SDK + dev-user backdoor), which doesn't exist on the server, so
// SSR'd auth-dependent UI mismatches the post-mount client render and
// trips React's hydration check. The app is designed to ship as static
// assets anyway — see project notes in CLAUDE.md.
const Dashboard = dynamic(() => import("./dashboard").then((m) => m.Dashboard), {
  ssr: false,
  loading: () => <GameShellFallback />,
})

export function FlowficGameClient() {
  return <Dashboard />
}
