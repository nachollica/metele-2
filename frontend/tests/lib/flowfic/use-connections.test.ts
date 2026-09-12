import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useConnections } from "@/lib/flowfic/use-connections"
import type { AuthContextValue } from "@/lib/auth"

const authState: { current: Partial<AuthContextValue> } = {
  current: { status: "authenticated", getAccessToken: vi.fn().mockResolvedValue("tok") },
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return { ...actual, useAuth: () => authState.current as AuthContextValue }
})

const api = vi.hoisted(() => ({
  fetchOwnInvite: vi.fn(),
  fetchConnections: vi.fn(),
  createOrRegenerateInvite: vi.fn(),
  revokeInvite: vi.fn(),
  removeConnection: vi.fn(),
}))

vi.mock("@/lib/flowfic/connections-api", () => api)

function setAuth(overrides: Partial<AuthContextValue>) {
  authState.current = {
    status: "authenticated",
    getAccessToken: vi.fn().mockResolvedValue("tok"),
    ...overrides,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("useConnections", () => {
  it("stays loading while auth resolves", () => {
    setAuth({ status: "loading" })
    const { result } = renderHook(() => useConnections())
    expect(result.current.inviteLoading).toBe(true)
    expect(result.current.connections).toBeNull()
    expect(api.fetchOwnInvite).not.toHaveBeenCalled()
  })

  it("resolves to an empty, non-loading state for an anonymous caller", async () => {
    setAuth({ status: "anonymous" })
    const { result } = renderHook(() => useConnections())
    await waitFor(() => expect(result.current.inviteLoading).toBe(false))
    expect(result.current.inviteToken).toBeNull()
    expect(result.current.connections).toEqual([])
    expect(api.fetchOwnInvite).not.toHaveBeenCalled()
  })

  it("loads the invite token and connections list for an authenticated caller", async () => {
    api.fetchOwnInvite.mockResolvedValue("tok123")
    api.fetchConnections.mockResolvedValue([
      { user: { id: "u1", name: "Alice", avatarUrl: null }, connectedAt: "t" },
    ])
    setAuth({})
    const { result } = renderHook(() => useConnections())
    await waitFor(() => expect(result.current.inviteLoading).toBe(false))
    expect(result.current.inviteToken).toBe("tok123")
    expect(result.current.connections).toHaveLength(1)
    expect(result.current.error).toBe(false)
  })

  it("flags an error when the connections list fails to load", async () => {
    api.fetchOwnInvite.mockResolvedValue(null)
    api.fetchConnections.mockResolvedValue(null)
    setAuth({})
    const { result } = renderHook(() => useConnections())
    await waitFor(() => expect(result.current.inviteLoading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.connections).toEqual([])
  })

  it("flags an error when no access token is available", async () => {
    api.fetchOwnInvite.mockResolvedValue("unused")
    setAuth({ getAccessToken: vi.fn().mockResolvedValue(null) })
    const { result } = renderHook(() => useConnections())
    await waitFor(() => expect(result.current.inviteLoading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(api.fetchOwnInvite).not.toHaveBeenCalled()
  })

  it("createOrRegenerate updates the invite token on success", async () => {
    api.fetchOwnInvite.mockResolvedValue(null)
    api.fetchConnections.mockResolvedValue([])
    api.createOrRegenerateInvite.mockResolvedValue("fresh-token")
    setAuth({})
    const { result } = renderHook(() => useConnections())
    await waitFor(() => expect(result.current.inviteLoading).toBe(false))

    let ok = false
    await waitFor(async () => {
      ok = await result.current.createOrRegenerate()
    })
    expect(ok).toBe(true)
    await waitFor(() => expect(result.current.inviteToken).toBe("fresh-token"))
  })

  it("createOrRegenerate resolves false on failure and leaves the token untouched", async () => {
    api.fetchOwnInvite.mockResolvedValue("existing")
    api.fetchConnections.mockResolvedValue([])
    api.createOrRegenerateInvite.mockResolvedValue(null)
    setAuth({})
    const { result } = renderHook(() => useConnections())
    await waitFor(() => expect(result.current.inviteToken).toBe("existing"))

    const ok = await result.current.createOrRegenerate()
    expect(ok).toBe(false)
    expect(result.current.inviteToken).toBe("existing")
  })

  it("revoke clears the invite token on success", async () => {
    api.fetchOwnInvite.mockResolvedValue("existing")
    api.fetchConnections.mockResolvedValue([])
    api.revokeInvite.mockResolvedValue(true)
    setAuth({})
    const { result } = renderHook(() => useConnections())
    await waitFor(() => expect(result.current.inviteToken).toBe("existing"))

    const ok = await result.current.revoke()
    expect(ok).toBe(true)
    await waitFor(() => expect(result.current.inviteToken).toBeNull())
  })

  it("revoke leaves the token untouched on failure", async () => {
    api.fetchOwnInvite.mockResolvedValue("existing")
    api.fetchConnections.mockResolvedValue([])
    api.revokeInvite.mockResolvedValue(false)
    setAuth({})
    const { result } = renderHook(() => useConnections())
    await waitFor(() => expect(result.current.inviteToken).toBe("existing"))

    const ok = await result.current.revoke()
    expect(ok).toBe(false)
    expect(result.current.inviteToken).toBe("existing")
  })

  it("remove drops the connection from the list on success", async () => {
    api.fetchOwnInvite.mockResolvedValue(null)
    api.fetchConnections.mockResolvedValue([
      { user: { id: "u1", name: "Alice", avatarUrl: null }, connectedAt: "t" },
      { user: { id: "u2", name: "Bob", avatarUrl: null }, connectedAt: "t" },
    ])
    api.removeConnection.mockResolvedValue(true)
    setAuth({})
    const { result } = renderHook(() => useConnections())
    await waitFor(() => expect(result.current.connections).toHaveLength(2))

    const ok = await result.current.remove("u1")
    expect(ok).toBe(true)
    await waitFor(() =>
      expect(result.current.connections?.map((c) => c.user.id)).toEqual(["u2"]),
    )
  })

  it("remove leaves the list untouched on failure", async () => {
    api.fetchOwnInvite.mockResolvedValue(null)
    api.fetchConnections.mockResolvedValue([
      { user: { id: "u1", name: "Alice", avatarUrl: null }, connectedAt: "t" },
    ])
    api.removeConnection.mockResolvedValue(false)
    setAuth({})
    const { result } = renderHook(() => useConnections())
    await waitFor(() => expect(result.current.connections).toHaveLength(1))

    const ok = await result.current.remove("u1")
    expect(ok).toBe(false)
    expect(result.current.connections).toHaveLength(1)
  })
})
