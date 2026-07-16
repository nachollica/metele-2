import { render, waitFor } from "@testing-library/react"
import { useEffect, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Hoisted spies so the (hoisted) vi.mock factory can close over them.
const { getAccessTokenSilently, logout } = vi.hoisted(() => ({
  getAccessTokenSilently: vi.fn(),
  logout: vi.fn(),
}))

vi.mock("@auth0/auth0-react", () => ({
  Auth0Provider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth0: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { sub: "google-oauth2|abc", name: "Jane" },
    getAccessTokenSilently,
    logout,
    loginWithRedirect: vi.fn(),
  }),
}))

import { useAuth } from "@/lib/auth/context"

// Drives `getAccessToken()` once on mount and reports the resolved value.
function TokenProbe({ onResult }: { onResult: (t: string | null) => void }) {
  const { getAccessToken } = useAuth()
  useEffect(() => {
    void getAccessToken().then(onResult)
  }, [getAccessToken, onResult])
  return null
}

// Mimic an Auth0 GenericError: a thrown Error carrying a string `error` code.
function authError(code: string): Error {
  return Object.assign(new Error(code), { error: code })
}

const LOCK_KEY = "browser-tabs-lock-key-auth0.lock.getTokenSilently.client.aud"

// jsdom under Node 22 doesn't expose a working localStorage, so back it with a
// simple in-memory Storage for these tests (recovery.ts iterates keys via
// `length` / `key(i)`).
function installMemoryStorage(): void {
  const map = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => {
      map.delete(k)
    },
    setItem: (k, v) => {
      map.set(k, String(v))
    },
  }
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  })
}

describe("useAuth().getAccessToken recovery", () => {
  beforeEach(() => {
    getAccessTokenSilently.mockReset()
    logout.mockReset()
    installMemoryStorage()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("returns the token on success without logging out", async () => {
    getAccessTokenSilently.mockResolvedValue("tok")
    const onResult = vi.fn()
    render(<TokenProbe onResult={onResult} />)
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("tok"))
    expect(logout).not.toHaveBeenCalled()
  })

  it("clears the session and stale locks when the refresh token is dead", async () => {
    window.localStorage.setItem(LOCK_KEY, "1")
    getAccessTokenSilently.mockRejectedValue(authError("invalid_grant"))
    const onResult = vi.fn()
    render(<TokenProbe onResult={onResult} />)
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(null))
    expect(logout).toHaveBeenCalledWith({ openUrl: false })
    expect(window.localStorage.getItem(LOCK_KEY)).toBeNull()
  })

  it("clears a wedged lock but keeps the session on a lock timeout", async () => {
    window.localStorage.setItem(LOCK_KEY, "1")
    getAccessTokenSilently.mockRejectedValue(authError("timeout"))
    const onResult = vi.fn()
    render(<TokenProbe onResult={onResult} />)
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(null))
    expect(logout).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(LOCK_KEY)).toBeNull()
  })

  it("returns null without touching session or locks on a transient error", async () => {
    window.localStorage.setItem(LOCK_KEY, "1")
    getAccessTokenSilently.mockRejectedValue(new Error("NetworkError"))
    const onResult = vi.fn()
    render(<TokenProbe onResult={onResult} />)
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(null))
    expect(logout).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(LOCK_KEY)).toBe("1")
  })
})
