"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/lib/auth"
import {
  deleteStory,
  fetchStories,
  updateStory,
  type Story,
} from "@/lib/flowfic/stories-api"

// Pull this many stories at a time (the backend's max). My Stories filters and
// searches client-side over the loaded set, so a search only sees what has been
// loaded; a proper backend search is a follow-up if libraries outgrow a page or
// two. The detail screen offers "Load more" for anything past the first page —
// before that existed the list silently stopped at this number.
const PAGE_SIZE = 100

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
  /** How many the account has in total, which is more than `stories.length`
   *  until every page is in. Null until the first response lands. */
  total: number | null
  /** Whether another page is waiting behind the loaded ones. */
  hasMore: boolean
  /** True while a follow-up page is in flight. */
  loadingMore: boolean
  /** Append the next page. A no-op when there is nothing left or one is
   *  already in flight. */
  loadMore: () => Promise<void>
  /** Optimistically remove a story; resolves false if the delete failed. */
  remove: (id: number) => Promise<boolean>
  /** Rename a story (title only; null clears to the derived title). Updates
   *  the list in place; resolves false if the update failed. */
  update: (id: number, title: string | null) => Promise<boolean>
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
  const [total, setTotal] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const erroredRef = useRef(false)
  useEffect(() => {
    erroredRef.current = error
  }, [error])

  useEffect(() => {
    if (status === "loading") return
    if (status === "anonymous") {
      setStories([])
      setTotal(0)
      setError(false)
      return
    }
    let cancelled = false
    setError(false)
    setStories(null)
    setTotal(null)
    void (async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const token = await getAccessToken()
        if (cancelled) return
        if (token !== null) {
          const res = await fetchStories(token, { limit: PAGE_SIZE, offset: 0 })
          if (cancelled) return
          if (res !== null) {
            setStories(res.items)
            setTotal(res.total)
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
      setTotal(0)
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

  const hasMore = stories !== null && total !== null && stories.length < total

  // Append the next page. Deliberately no retry ladder: the first load owns the
  // resilience, and a failed "load more" leaves the list exactly as it was for
  // the user to click again.
  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingMore) return
    const loaded = stories?.length ?? 0
    if (total === null || loaded >= total) return
    setLoadingMore(true)
    const token = await getAccessToken()
    if (token === null) {
      setLoadingMore(false)
      return
    }
    const res = await fetchStories(token, { limit: PAGE_SIZE, offset: loaded })
    setLoadingMore(false)
    if (res === null) return
    // Merge by id: a story saved between the two requests would otherwise shift
    // the offset window and duplicate a row across the seam.
    setStories((prev) => {
      const base = prev ?? []
      const seen = new Set(base.map((s) => s.id))
      return [...base, ...res.items.filter((s) => !seen.has(s.id))]
    })
    setTotal(res.total)
  }, [getAccessToken, loadingMore, stories, total])

  const remove = useCallback(
    async (id: number): Promise<boolean> => {
      const token = await getAccessToken()
      if (token === null) return false
      const ok = await deleteStory(token, id)
      if (!ok) return false
      setStories((prev) => (prev === null ? prev : prev.filter((s) => s.id !== id)))
      // Keep the count honest without a refetch — it heads the detail screen.
      setTotal((prev) => (prev === null ? prev : Math.max(0, prev - 1)))
      return true
    },
    [getAccessToken],
  )

  const update = useCallback(
    async (id: number, title: string | null): Promise<boolean> => {
      const token = await getAccessToken()
      if (token === null) return false
      const updated = await updateStory(token, id, title)
      if (updated === null) return false
      setStories((prev) =>
        prev === null ? prev : prev.map((s) => (s.id === id ? updated : s)),
      )
      return true
    },
    [getAccessToken],
  )

  return { stories, error, total, hasMore, loadingMore, loadMore, remove, update }
}
