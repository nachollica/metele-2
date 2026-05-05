import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  TOKEN_STORAGE_KEY,
  authApiUrl,
  buildCallbackReturnUrl,
  fetchMe,
  logoutRequest,
  persistToken,
  readStoredToken,
  startProviderLogin,
} from "@/lib/auth/client"

describe("authApiUrl", () => {
  it("joins paths to the configured backend host", () => {
    expect(authApiUrl("/auth/me")).toBe("http://localhost:8000/auth/me")
    expect(authApiUrl("auth/me")).toBe("http://localhost:8000/auth/me")
  })
})

describe("token persistence", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("round-trips a token through localStorage", () => {
    expect(readStoredToken()).toBeNull()
    persistToken("abc.def.ghi")
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe("abc.def.ghi")
    expect(readStoredToken()).toBe("abc.def.ghi")
  })

  it("clears the stored token when given null", () => {
    persistToken("abc")
    persistToken(null)
    expect(readStoredToken()).toBeNull()
  })

  it("ignores localStorage failures (private mode)", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota")
      })
    expect(() => persistToken("abc")).not.toThrow()
    setItem.mockRestore()

    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("nope")
      })
    expect(readStoredToken()).toBeNull()
    getItem.mockRestore()
  })
})

describe("buildCallbackReturnUrl", () => {
  it("uses the current origin and the requested locale", () => {
    expect(buildCallbackReturnUrl("en")).toBe(
      `${window.location.origin}/en/auth/callback`,
    )
    expect(buildCallbackReturnUrl("es")).toBe(
      `${window.location.origin}/es/auth/callback`,
    )
  })
})

describe("startProviderLogin", () => {
  let assign: ReturnType<typeof vi.fn>

  beforeEach(() => {
    assign = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign, origin: "http://localhost:3000" },
    })
  })

  it("redirects to the real provider login with the encoded return_to", () => {
    startProviderLogin("google", "en")
    expect(assign).toHaveBeenCalledOnce()
    const url = new URL(assign.mock.calls[0]?.[0] as string)
    expect(url.origin).toBe("http://localhost:8000")
    expect(url.pathname).toBe("/auth/google/login")
    expect(url.searchParams.get("return_to")).toBe(
      "http://localhost:3000/en/auth/callback",
    )
  })

  it("uses the mock route when options.mock is true", () => {
    startProviderLogin("instagram", "es", { mock: true })
    const url = new URL(assign.mock.calls[0]?.[0] as string)
    expect(url.pathname).toBe("/auth/mock/instagram/login")
    expect(url.searchParams.get("return_to")).toBe(
      "http://localhost:3000/es/auth/callback",
    )
  })
})

describe("fetchMe", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the parsed user when /auth/me is OK", async () => {
    const user = {
      id: "google:1",
      provider: "google",
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
        headers: { Authorization: "Bearer token" },
      }),
    )
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

describe("logoutRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("POSTs to /auth/logout with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)
    await logoutRequest("token")
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer token" },
      }),
    )
  })

  it("swallows network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    await expect(logoutRequest("token")).resolves.toBeUndefined()
  })
})
