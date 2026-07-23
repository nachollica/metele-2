"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/lib/auth"
import { deleteStory, fetchStories, type Story } from "@/lib/flowfic/stories-api"

// Pull this many stories at a time; the sections scroll within their own
// viewport. A larger page is a cheap follow-up if needed.
const PAGE_SIZE = 50

// A silent token refresh can transiently fail on resume-after-inactivity.
// Retry a few times with short backoff so the list self-heals.
const RETRY_BACKOFF_MS = [600, 1500]
const MAX_ATTEMPTS = RETRY_BACKOFF_MS.length + 1

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type UseStories = {
  /** Null while the first load is in flight. */
  stories: Story[] | null
  /** True after all retries failed. */
  error: boolean
  /** Optimistically remove a story; resolves false if the delete failed. */
  remove: (id: number) => Promise<boolean>
}

/**
 * Load the caller's stories, refetching when `refreshKey` bumps (e.g. after a
 * sprint is saved). Anonymous users resolve to an empty list. Ported from the
 * former StoriesSidebar so the resilient token-retry + resume-recovery
 * behavior is preserved.
 */
export function useStories(refreshKey = 0): UseStories {
  const { status, getAccessToken } = useAuth()
  const [stories, setStories] = useState<Story[] | null>(null)
  const [error, setError] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  const erroredRef = useRef(false)
  useEffect(() => {
    erroredRef.current = error
  }, [error])

  useEffect(() => {
    if (status === "loading") return
    if (status === "anonymous") {
      setStories([])
      setError(false)
      return
    }
    let cancelled = false
    setError(false)
    setStories(null)
    void (async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const token = await getAccessToken()
        if (cancelled) return
        if (token !== null) {
          const res = await fetchStories(token, { limit: PAGE_SIZE, offset: 0 })
          if (cancelled) return
          if (res !== null) {
            setStories(res.items)
            return
          }
        }
        const backoff = RETRY_BACKOFF_MS[attempt]
        if (backoff === undefined) break
        await delay(backoff)
        if (cancelled) return
      }
      setError(true)
      setStories([])
    })()
    return () => {
      cancelled = true
    }
  }, [getAccessToken, refreshKey, status, retryTick])

  // Recover from a failed load when the tab regains focus / connectivity.
  useEffect(() => {
    const retry = () => {
      if (erroredRef.current) setRetryTick((n) => n + 1)
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") retry()
    }
    window.addEventListener("focus", retry)
    window.addEventListener("online", retry)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("focus", retry)
      window.removeEventListener("online", retry)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  const remove = useCallback(
    async (id: number): Promise<boolean> => {
      const token = await getAccessToken()
      if (token === null) return false
      const ok = await deleteStory(token, id)
      if (!ok) return false
      setStories((prev) => (prev === null ? prev : prev.filter((s) => s.id !== id)))
      return true
    },
    [getAccessToken],
  )

  return { stories, error, remove }
}
