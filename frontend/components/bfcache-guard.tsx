"use client"

import { useEffect } from "react"

import { authRedirectState } from "@/lib/auth/client"

// Force a fresh load when a page frozen mid auth-redirect is restored from the
// browser's back/forward cache (bfcache).
//
// The app leaves the SPA with a full-page navigation for the Auth0 login /
// logout redirect. Browsers freeze the whole page — JS heap and React state —
// into the bfcache, and pressing Back restores that frozen snapshot instead of
// reloading. That snapshot is stale in ways the app can't recover from:
//   - the login modal's `pending` flag is still set, so every social button
//     stays `disabled` (Chrome shows the modal but nothing is clickable);
//   - the game tree is mounted via `dynamic(ssr:false)` with the Auth0 SDK
//     mid-flight, and the App Router's navigation promise never resolves
//     (Firefox shows a blank page / an endless Route spinner).
//
// `pageshow` with `event.persisted === true` fires only on a bfcache restore.
// We reload ONLY when this restored page was the one that initiated the auth
// redirect (`authRedirectState.inFlight`, a module flag frozen into the heap
// alongside the page). Ordinary in-app navigation is same-document
// `popstate` — it never evicts the document, so it never reaches this guard,
// and section state is preserved without a reload.
export function BfcacheGuard() {
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted && authRedirectState.inFlight) window.location.reload()
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])
  return null
}
