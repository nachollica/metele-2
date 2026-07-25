// Client for the backend `/stats` gamification endpoints.
//
// Every call needs a bearer token (anonymous users have no stories, so callers
// skip these entirely). Each request forwards the browser timezone so the
// backend buckets days against the player's wall clock. Failures resolve to
// null — the dashboard degrades to an empty/zeroed state rather than throwing.

import { apiFetch } from "@/lib/auth/client"
import type { Achievement, Challenge, Overview } from "@/lib/flowfic/gamification"

/** The browser's IANA timezone, or "UTC" when it can't be resolved. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

function withTz(path: string): string {
  const params = new URLSearchParams({ tz: browserTimeZone() })
  return `${path}?${params.toString()}`
}

async function getJson<T>(token: string, path: string, label: string): Promise<T | null> {
  try {
    const res = await apiFetch(token, withTz(path))
    if (!res.ok) {
      console.warn(`[stats-api] ${label} failed ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn(`[stats-api] ${label} unreachable`, err)
    return null
  }
}

export function fetchOverview(token: string): Promise<Overview | null> {
  return getJson<Overview>(token, "/stats/overview", "overview")
}

export function fetchAchievements(token: string): Promise<Achievement[] | null> {
  return getJson<Achievement[]>(token, "/stats/achievements", "achievements")
}

export function fetchChallenges(token: string): Promise<Challenge[] | null> {
  return getJson<Challenge[]>(token, "/stats/challenges", "challenges")
}
