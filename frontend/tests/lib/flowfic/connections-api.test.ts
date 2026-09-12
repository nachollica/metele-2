import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  acceptInvite,
  createOrRegenerateInvite,
  fetchConnections,
  fetchInvitePreview,
  fetchOwnInvite,
  removeConnection,
  revokeInvite,
} from "@/lib/flowfic/connections-api"

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("fetchOwnInvite", () => {
  it("returns the token from a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "abc" }) }))
    expect(await fetchOwnInvite("tok")).toBe("abc")
  })

  it("returns null when there is no active invite", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: null }) }))
    expect(await fetchOwnInvite("tok")).toBeNull()
  })

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    expect(await fetchOwnInvite("tok")).toBeNull()
  })

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")))
    expect(await fetchOwnInvite("tok")).toBeNull()
  })
})

describe("createOrRegenerateInvite", () => {
  it("POSTs and returns the new token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "new" }) })
    vi.stubGlobal("fetch", fetchMock)
    expect(await createOrRegenerateInvite("tok")).toBe("new")
    const [calledUrl, init] = fetchMock.mock.calls[0] ?? []
    expect(calledUrl).toBe("http://localhost:8000/api/connections/invite")
    expect((init as RequestInit).method).toBe("POST")
  })

  it("returns null on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    expect(await createOrRegenerateInvite("tok")).toBeNull()
  })
})

describe("revokeInvite", () => {
  it("DELETEs and resolves true on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)
    expect(await revokeInvite("tok")).toBe(true)
    const [, init] = fetchMock.mock.calls[0] ?? []
    expect((init as RequestInit).method).toBe("DELETE")
  })

  it("resolves false on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    expect(await revokeInvite("tok")).toBe(false)
  })

  it("resolves false when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")))
    expect(await revokeInvite("tok")).toBe(false)
  })
})

describe("fetchInvitePreview", () => {
  it("hits the public preview route without a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ inviter: { id: "u1", name: "Alice", avatarUrl: null } }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const result = await fetchInvitePreview("sometoken")
    expect(result).toEqual({ id: "u1", name: "Alice", avatarUrl: null })
    const [calledUrl, init] = fetchMock.mock.calls[0] ?? []
    expect(calledUrl).toBe("http://localhost:8000/api/connections/invite/sometoken")
    expect(init).toBeUndefined()
  })

  it("returns null on a 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await fetchInvitePreview("bad")).toBeNull()
  })
})

describe("acceptInvite", () => {
  it("POSTs to the accept endpoint and returns the connection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: "u1", name: "Alice", avatarUrl: null },
        connectedAt: "2026-01-01T00:00:00Z",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const result = await acceptInvite("tok", "sometoken")
    expect(result?.user.id).toBe("u1")
    const [calledUrl, init] = fetchMock.mock.calls[0] ?? []
    expect(calledUrl).toBe("http://localhost:8000/api/connections/invite/sometoken/accept")
    expect((init as RequestInit).method).toBe("POST")
  })

  it("returns null on failure (e.g. 409 own link, 404 unknown)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409 }))
    expect(await acceptInvite("tok", "sometoken")).toBeNull()
  })
})

describe("fetchConnections", () => {
  it("returns the parsed list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ user: { id: "u1", name: "Alice", avatarUrl: null }, connectedAt: "t" }],
      }),
    )
    const result = await fetchConnections("tok")
    expect(result).toHaveLength(1)
  })

  it("returns null on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    expect(await fetchConnections("tok")).toBeNull()
  })
})

describe("removeConnection", () => {
  it("DELETEs the pair and resolves true on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)
    expect(await removeConnection("tok", "u2")).toBe(true)
    const [calledUrl, init] = fetchMock.mock.calls[0] ?? []
    expect(calledUrl).toBe("http://localhost:8000/api/connections/u2")
    expect((init as RequestInit).method).toBe("DELETE")
  })

  it("resolves false on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    expect(await removeConnection("tok", "u2")).toBe(false)
  })
})
