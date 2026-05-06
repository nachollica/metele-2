// Client for the backend `/stories` endpoints.
//
// Auth-free for now: every record is anonymous on the backend until the auth
// flow is wired through. The list call is plain GET; the POST runs at end of
// session to persist whatever the player wrote.

import { authApiUrl } from "@/lib/auth/client"

export type Story = {
  id: number
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
    text: s.text,
    lang: s.lang,
    createdAt: s.created_at,
    userId: s.user_id,
    settings: s.settings,
    stats: s.stats,
  }
}

export async function fetchStories(
  options: { limit?: number; offset?: number } = {},
): Promise<StoryListResponse | null> {
  const url = new URL(authApiUrl("/stories"))
  if (options.limit !== undefined) url.searchParams.set("limit", String(options.limit))
  if (options.offset !== undefined) url.searchParams.set("offset", String(options.offset))
  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      console.log(`[stories-api] list failed ${res.status}`)
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
    console.log("[stories-api] list unreachable", err)
    return null
  }
}

export type CreateStoryInput = {
  text: string
  lang: string
  settings: Record<string, unknown>
  stats: Record<string, unknown>
}

export async function createStory(input: CreateStoryInput): Promise<Story | null> {
  try {
    const res = await fetch(authApiUrl("/stories"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      console.log(`[stories-api] create failed ${res.status}`)
      return null
    }
    const data = (await res.json()) as StoryWire
    return fromWire(data)
  } catch (err) {
    console.log("[stories-api] create unreachable", err)
    return null
  }
}
