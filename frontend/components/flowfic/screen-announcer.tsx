"use client"

import { useEffect, useRef, useState } from "react"

import { APP_NAME } from "./screen-header"

/**
 * Document title for a screen. The app is one static route, so nothing updates
 * `<title>` on its own — `app/layout.tsx` pins it to the app name for the whole
 * session, which leaves every browser tab, every bookmark, and every
 * screen-reader "where am I" query saying the same thing.
 *
 * `null` is the sprint, which is not an addressable screen and gets the bare
 * app name back.
 */
export function screenDocumentTitle(title: string | null): string {
  return title === null ? APP_NAME : `${title} — ${APP_NAME}`
}

/**
 * Names the visible screen for assistive tech after a client-side navigation.
 *
 * Routing here is `history.pushState` + a state update, which a screen reader
 * has no way to notice: no document load fires, and the heading that changed is
 * off in the top bar rather than where focus is. So the screen's title is both
 * written to `document.title` and pushed through a polite live region.
 *
 * The first render is deliberately silent — the screen was not navigated to,
 * it was loaded, and the page load already announced itself.
 */
export function ScreenAnnouncer({ title }: { title: string | null }) {
  const [message, setMessage] = useState("")
  const previous = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    document.title = screenDocumentTitle(title)
    const isFirst = previous.current === undefined
    const changed = previous.current !== title
    previous.current = title
    // A sprint suppresses the header title, and its own controls announce it.
    if (isFirst || !changed || title === null) return
    setMessage(title)
  }, [title])

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}
