// Client for the profile-related backend endpoints.
//
// `updateProfile` PATCHes `/auth/me` with whatever subset of fields the user
// edited; `fetchStoryCount` hits `/stories/count` so the profile screen can
// show "you've written N stories".

import { apiFetch } from "@/lib/auth/client"
import type { AuthUser } from "@/lib/auth"

export type ProfileUpdate = {
  name?: string
  email?: string | null
  picture?: string | null
}

type AuthUserWire = {
  id: string
  email: string | null
  name: string
  avatarUrl: string | null
}

export async function updateProfile(
  token: string,
  patch: ProfileUpdate,
): Promise<AuthUser | null> {
  try {
    const res = await apiFetch(token, "/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      console.log(`[profile-api] update failed ${res.status}`)
      return null
    }
    return (await res.json()) as AuthUserWire
  } catch (err) {
    console.log("[profile-api] update unreachable", err)
    return null
  }
}

export async function fetchStoryCount(token: string): Promise<number | null> {
  try {
    const res = await apiFetch(token, "/stories/count")
    if (!res.ok) {
      console.log(`[profile-api] count failed ${res.status}`)
      return null
    }
    const data = (await res.json()) as { count: number }
    return typeof data.count === "number" ? data.count : null
  } catch (err) {
    console.log("[profile-api] count unreachable", err)
    return null
  }
}
