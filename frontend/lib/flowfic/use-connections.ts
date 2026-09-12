"use client"

import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/lib/auth"
import {
  createOrRegenerateInvite,
  fetchConnections,
  fetchOwnInvite,
  removeConnection,
  revokeInvite,
  type Connection,
} from "@/lib/flowfic/connections-api"

export type UseConnections = {
  /** Null until the invite has loaded once, or when it is disabled. */
  inviteToken: string | null
  /** True until the initial invite fetch has resolved. */
  inviteLoading: boolean
  /** Null while the first load of the connections list is in flight. */
  connections: Connection[] | null
  /** True after the connections list failed to load. */
  error: boolean
  /** True while a create/regenerate/revoke request is in flight. */
  inviteBusy: boolean
  /** Create the invite, or regenerate it if one already exists. Resolves
   *  false if the request failed. */
  createOrRegenerate: () => Promise<boolean>
  /** Revoke the invite. Resolves false if the request failed. */
  revoke: () => Promise<boolean>
  /** Remove a connection; resolves false if the request failed. */
  remove: (userId: string) => Promise<boolean>
}

/**
 * Load the caller's invite link and connections list once, signed-in only.
 * Mirrors `useStories`' shape (null-until-loaded, boolean error flag) but
 * without its retry ladder or pagination — a connections list is expected to
 * stay small, since the only way to grow it is a link shared by hand.
 */
export function useConnections(): UseConnections {
  const { status, getAccessToken } = useAuth()
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(true)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [connections, setConnections] = useState<Connection[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    if (status === "anonymous") {
      setInviteToken(null)
      setInviteLoading(false)
      setConnections([])
      setError(false)
      return
    }
    let cancelled = false
    void (async () => {
      const token = await getAccessToken()
      if (cancelled) return
      if (token === null) {
        setInviteLoading(false)
        setError(true)
        setConnections([])
        return
      }
      const [invite, list] = await Promise.all([
        fetchOwnInvite(token),
        fetchConnections(token),
      ])
      if (cancelled) return
      setInviteToken(invite)
      setInviteLoading(false)
      if (list === null) {
        setError(true)
        setConnections([])
      } else {
        setError(false)
        setConnections(list)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, getAccessToken])

  const createOrRegenerate = useCallback(async (): Promise<boolean> => {
    setInviteBusy(true)
    const token = await getAccessToken()
    if (token === null) {
      setInviteBusy(false)
      return false
    }
    const next = await createOrRegenerateInvite(token)
    setInviteBusy(false)
    if (next === null) return false
    setInviteToken(next)
    return true
  }, [getAccessToken])

  const revoke = useCallback(async (): Promise<boolean> => {
    setInviteBusy(true)
    const token = await getAccessToken()
    if (token === null) {
      setInviteBusy(false)
      return false
    }
    const ok = await revokeInvite(token)
    setInviteBusy(false)
    if (ok) setInviteToken(null)
    return ok
  }, [getAccessToken])

  const remove = useCallback(
    async (userId: string): Promise<boolean> => {
      const token = await getAccessToken()
      if (token === null) return false
      const ok = await removeConnection(token, userId)
      if (!ok) return false
      setConnections((prev) => (prev === null ? prev : prev.filter((c) => c.user.id !== userId)))
      return true
    },
    [getAccessToken],
  )

  return {
    inviteToken,
    inviteLoading,
    connections,
    error,
    inviteBusy,
    createOrRegenerate,
    revoke,
    remove,
  }
}
