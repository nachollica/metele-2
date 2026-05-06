import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchStoryCount, updateProfile } from "@/lib/metele/profile-api"

describe("updateProfile", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("PATCHes /auth/me with the bearer token and a JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "google-oauth2|abc",
        email: "x@example.com",
        name: "Renamed",
        avatarUrl: null,
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await updateProfile("tok", { name: "Renamed" })
    expect(result?.name).toBe("Renamed")

    const [calledUrl, init] = fetchMock.mock.calls[0] ?? []
    expect(calledUrl).toBe("http://localhost:8000/auth/me")
    expect((init as RequestInit).method).toBe("PATCH")
    expect((init as RequestInit).body).toBe(JSON.stringify({ name: "Renamed" }))
    const headers = (init as RequestInit).headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer tok")
    expect(headers.get("Content-Type")).toBe("application/json")
  })

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422 }))
    expect(await updateProfile("tok", { name: "x" })).toBeNull()
  })

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")))
    expect(await updateProfile("tok", { name: "x" })).toBeNull()
  })
})

describe("fetchStoryCount", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the parsed count when /stories/count is OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 7 }) }),
    )
    expect(await fetchStoryCount("tok")).toBe(7)
  })

  it("returns null when the count is missing or wrong shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    )
    expect(await fetchStoryCount("tok")).toBeNull()
  })

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    expect(await fetchStoryCount("tok")).toBeNull()
  })
})
