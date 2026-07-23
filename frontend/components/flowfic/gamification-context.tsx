"use client"

// Shares one fetch of the gamification payloads (overview / achievements /
// challenges) across the sidebar and every section, refetching after a story
// is saved. Anonymous users have no stories, so it resolves to nulls and the
// consumers render their empty/zeroed states.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import { useAuth } from "@/lib/auth"
import {
  fetchAchievements,
  fetchChallenges,
  fetchOverview,
} from "@/lib/flowfic/stats-api"
import type { Achievement, Challenge, Overview } from "@/lib/flowfic/gamification"

type GamificationData = {
  overview: Overview | null
  achievements: Achievement[] | null
  challenges: Challenge[] | null
  /** True while the first authenticated load is in flight. */
  loading: boolean
}

const EMPTY: GamificationData = {
  overview: null,
  achievements: null,
  challenges: null,
  loading: false,
}

const GamificationContext = createContext<GamificationData>(EMPTY)

export function useGamification(): GamificationData {
  return useContext(GamificationContext)
}

// A briefly-null token on resume can make the first load fail; a couple of
// short retries let the panels self-heal rather than latching empty.
const RETRY_BACKOFF_MS = [500, 1200]

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function GamificationProvider({
  refreshKey = 0,
  children,
}: {
  /** Bump to force a refetch (e.g. after a story is saved). */
  refreshKey?: number
  children: ReactNode
}) {
  const { status, getAccessToken } = useAuth()
  const [data, setData] = useState<GamificationData>(EMPTY)

  useEffect(() => {
    if (status === "loading") return
    if (status === "anonymous") {
      setData(EMPTY)
      return
    }

    let cancelled = false
    setData((d) => ({ ...d, loading: true }))

    void (async () => {
      for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
        const token = await getAccessToken()
        if (cancelled) return
        if (token !== null) {
          const [overview, achievements, challenges] = await Promise.all([
            fetchOverview(token),
            fetchAchievements(token),
            fetchChallenges(token),
          ])
          if (cancelled) return
          if (overview !== null || achievements !== null || challenges !== null) {
            setData({ overview, achievements, challenges, loading: false })
            return
          }
        }
        const backoff = RETRY_BACKOFF_MS[attempt]
        if (backoff === undefined) break
        await delay(backoff)
        if (cancelled) return
      }
      setData({ overview: null, achievements: null, challenges: null, loading: false })
    })()

    return () => {
      cancelled = true
    }
  }, [status, getAccessToken, refreshKey])

  return <GamificationContext value={data}>{children}</GamificationContext>
}
