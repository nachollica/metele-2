// Client for the backend `/stories` endpoints.
//
// Every call requires a bearer access token issued by Auth0; callers obtain
// one via `useAuth().getAccessToken()`. A null token means the user is
// anonymous — callers should skip the request rather than calling here.

import { apiFetch } from "@/lib/auth/client"
import type { GameResult, GameSettings } from "@/lib/flowfic/types"

export type Story = {
  id: number
  /** Optional display title; derived from the text on the client when null. */
  title: string | null
  text: string
  lang: string
  /** ISO-8601 timestamp; `Date` after `new Date(s.createdAt)`. */
  createdAt: string
  userId: string | null
  settings: Record<string, unknown>
  stats: Record<string, unknown>
}

export type StoryListResponse = {
  items: Story[]
  total: number
  limit: number
  offset: number
}

type StoryWire = {
  id: number
  title: string | null
  text: string
  lang: string
  created_at: string
  user_id: string | null
  settings: Record<string, unknown>
  stats: Record<string, unknown>
}

function fromWire(s: StoryWire): Story {
  return {
    id: s.id,
    title: s.title ?? null,
    text: s.text,
    lang: s.lang,
    createdAt: s.created_at,
    userId: s.user_id,
    settings: s.settings,
    stats: s.stats,
  }
}

export async function fetchStories(
  token: string,
  options: { limit?: number; offset?: number } = {},
): Promise<StoryListResponse | null> {
  const params = new URLSearchParams()
  if (options.limit !== undefined) params.set("limit", String(options.limit))
  if (options.offset !== undefined) params.set("offset", String(options.offset))
  const path = params.size > 0 ? `/stories?${params.toString()}` : "/stories"
  try {
    const res = await apiFetch(token, path)
    if (!res.ok) {
      console.warn(`[stories-api] list failed ${res.status}`)
      return null
    }
    const data = (await res.json()) as { items: StoryWire[]; total: number; limit: number; offset: number }
    return {
      items: data.items.map(fromWire),
      total: data.total,
      limit: data.limit,
      offset: data.offset,
    }
  } catch (err) {
    console.warn("[stories-api] list unreachable", err)
    return null
  }
}

// The stats half of a finished session, minus the story text (which the
// backend persists on its own `text` column). Mirrors `StoryStatsStrict`.
export type StorySaveStats = Omit<GameResult, "text">

export type CreateStoryInput = {
  text: string
  lang: string
  // The full GameSettings snapshot — the backend validates it strictly
  // against StorySettingsStrict, so the shapes must match exactly.
  settings: GameSettings
  stats: StorySaveStats
}

export async function createStory(
  token: string,
  input: CreateStoryInput,
): Promise<Story | null> {
  try {
    const res = await apiFetch(token, "/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      console.warn(`[stories-api] create failed ${res.status}`)
      return null
    }
    const data = (await res.json()) as StoryWire
    return fromWire(data)
  } catch (err) {
    console.warn("[stories-api] create unreachable", err)
    return null
  }
}

export async function deleteStory(token: string, id: number): Promise<boolean> {
  try {
    const res = await apiFetch(token, `/stories/${id}`, { method: "DELETE" })
    if (!res.ok) {
      console.warn(`[stories-api] delete failed ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.warn("[stories-api] delete unreachable", err)
    return false
  }
}
