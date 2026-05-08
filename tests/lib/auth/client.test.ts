import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AUTH0_CONNECTION,
  apiFetch,
  apiUrl,
  buildRedirectUri,
  fetchMe,
  readAuth0Config,
} from "@/lib/auth/client"

describe("apiUrl", () => {
  it("joins paths to the configured backend host", () => {
    expect(apiUrl("/auth/me")).toBe("http://localhost:8000/auth/me")
    expect(apiUrl("auth/me")).toBe("http://localhost:8000/auth/me")
  })
})

describe("AUTH0_CONNECTION", () => {
  it("maps internal provider ids to Auth0 connection names", () => {
    expect(AUTH0_CONNECTION.google).toBe("google-oauth2")
    expect(AUTH0_CONNECTION.facebook).toBe("facebook")
  })
})

describe("buildRedirectUri", () => {
  it("uses the current origin", () => {
    expect(buildRedirectUri()).toBe(
      `${window.location.origin}/auth/callback`,
    )
  })
})

describe("readAuth0Config", () => {
  it("returns null when any of the env vars are missing", () => {
    // Vitest's `process.env` is the host process; the three vars are not set
    // in the test runner so the helper must fall back to null.
    expect(readAuth0Config()).toBeNull()
  })
})

describe("fetchMe", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the parsed user when /auth/me is OK", async () => {
    const user = {
      id: "google-oauth2|abc",
      email: "x@example.com",
      name: "X",
      avatarUrl: null,
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => user,
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchMe("token")
    expect(result).toEqual(user)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/auth/me",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer token")
  })

  it("returns null when /auth/me responds non-OK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    expect(await fetchMe("token")).toBeNull()
  })

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")))
    expect(await fetchMe("token")).toBeNull()
  })
})

describe("apiFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("attaches a bearer token and resolves the path against the API host", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)
    await apiFetch("tok", "/stories", { method: "GET" })

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] ?? []
    expect(calledUrl).toBe("http://localhost:8000/stories")
    const headers = (calledInit as RequestInit).headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer tok")
  })
})
