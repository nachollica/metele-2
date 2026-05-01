"use client"

import { MeteleGame } from "@/components/metele/metele-game"

// All gameplay logic is client-side rendered so the entire app can be
// served as static assets.
export default function Page() {
  return <MeteleGame />
}
