// Client for the backend `/connections` endpoints: a user's own standing
// invite link, and the mutual connections it creates.
//
// Every call except `fetchInvitePreview` requires a bearer access token —
// callers obtain one via `useAuth().getAccessToken()`. The preview call is
// deliberately unauthenticated: it is how a visitor without a token yet (or
// without an account at all) learns whose link they are holding, before
// signing in.

import { apiFetch, apiUrl } from "@/lib/auth/client"

export type PublicUser = {
  id: string
  name: string
  avatarUrl: string | null
}

export type Connection = {
  user: PublicUser
  /** ISO-8601 timestamp. */
  connectedAt: string
}

/**
 * The caller's own invite link, or null when there is none (never created, or
 * revoked) — collapsing the "no invite" and "request failed" cases the same
 * way `fetchStoryCount` does, since both leave the caller looking at the same
 * "create a link" affordance.
 */
export async function fetchOwnInvite(token: string): Promise<string | null> {
  try {
    const res = await apiFetch(token, "/connections/invite")
    if (!res.ok) return null
    const data = (await res.json()) as { token: string | null }
    return data.token
  } catch (err) {
    console.warn("[connections-api] fetch invite unreachable", err)
    return null
  }
}

/** Create the caller's invite link, or regenerate it if one already exists. */
export async function createOrRegenerateInvite(token: string): Promise<string | null> {
  try {
    const res = await apiFetch(token, "/connections/invite", { method: "POST" })
    if (!res.ok) return null
    const data = (await res.json()) as { token: string | null }
    return data.token
  } catch (err) {
    console.warn("[connections-api] create invite unreachable", err)
    return null
  }
}

/** Revoke the caller's invite link. */
export async function revokeInvite(token: string): Promise<boolean> {
  try {
    const res = await apiFetch(token, "/connections/invite", { method: "DELETE" })
    return res.ok
  } catch (err) {
    console.warn("[connections-api] revoke invite unreachable", err)
    return false
  }
}

/**
 * Preview who an invite link belongs to. Unauthenticated on purpose (see
 * module docstring), so it hits the backend directly rather than through
 * `apiFetch`, which always attaches a bearer token.
 */
export async function fetchInvitePreview(inviteToken: string): Promise<PublicUser | null> {
  try {
    const res = await fetch(apiUrl(`/connections/invite/${inviteToken}`))
    if (!res.ok) return null
    const data = (await res.json()) as { inviter: PublicUser }
    return data.inviter
  } catch (err) {
    console.warn("[connections-api] preview invite unreachable", err)
    return null
  }
}

/** Accept an invite link, connecting the caller with its owner. */
export async function acceptInvite(
  token: string,
  inviteToken: string,
): Promise<Connection | null> {
  try {
    const res = await apiFetch(token, `/connections/invite/${inviteToken}/accept`, {
      method: "POST",
    })
    if (!res.ok) return null
    return (await res.json()) as Connection
  } catch (err) {
    console.warn("[connections-api] accept invite unreachable", err)
    return null
  }
}

/** List the caller's connections. */
export async function fetchConnections(token: string): Promise<Connection[] | null> {
  try {
    const res = await apiFetch(token, "/connections")
    if (!res.ok) return null
    return (await res.json()) as Connection[]
  } catch (err) {
    console.warn("[connections-api] list unreachable", err)
    return null
  }
}

/** Remove a connection. */
export async function removeConnection(token: string, otherUserId: string): Promise<boolean> {
  try {
    const res = await apiFetch(token, `/connections/${otherUserId}`, { method: "DELETE" })
    return res.ok
  } catch (err) {
    console.warn("[connections-api] remove unreachable", err)
    return false
  }
}
