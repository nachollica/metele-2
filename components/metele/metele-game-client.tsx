"use client"

import dynamic from "next/dynamic"

// Skip SSR for the whole game tree. Auth state lives in localStorage
// (Auth0 SDK + dev-user backdoor), which doesn't exist on the server, so
// SSR'd auth-dependent UI mismatches the post-mount client render and
// trips React's hydration check. The app is designed to ship as static
// assets anyway — see project notes in CLAUDE.md.
const MeteleGame = dynamic(
  () => import("./metele-game").then((m) => m.MeteleGame),
  { ssr: false },
)

export function MeteleGameClient() {
  return <MeteleGame />
}
