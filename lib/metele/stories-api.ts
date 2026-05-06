// Client for the backend `/stories` endpoints.
//
// Every call requires a bearer access token issued by Auth0; callers obtain
// one via `useAuth().getAccessToken()`. A null token means the user is
// anonymous — callers should skip the request rather than calling here.

import { apiFetch } from "@/lib/auth/client"

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
