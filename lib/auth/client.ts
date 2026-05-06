"use client"

import type { AuthProvider, AuthUser } from "./types"

// Backend base URL. Configurable via NEXT_PUBLIC_AUTH_API_URL so production can
// point at the deployed FastAPI host while local dev uses the uvicorn default.
const API_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AUTH_API_URL) ||
  "http://localhost:8000"

export const TOKEN_STORAGE_KEY = "metele.auth.token"

export function authApiUrl(path: string): string {
  return `${API_URL.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`
}

export function readStoredToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function persistToken(token: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (token === null) {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    } else {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
    }
  } catch {
    // ignore — incognito/private modes may block storage
  }
}

// Build the absolute URL the OAuth callback should redirect to once the
// backend has minted a session token. The token is appended as a URL fragment
// so it is never sent to the static-host's access logs.
export function buildCallbackReturnUrl(locale: string): string {
  if (typeof window === "undefined") return ""
  const base = `${window.location.origin}/${locale}/auth/callback`
  return base
}

// Kick off the OAuth flow by navigating away to the backend's login endpoint.
// `mock` selects the mocked variant the backend exposes for end-to-end testing
// without real provider credentials.
export function startProviderLogin(
  provider: AuthProvider,
  locale: string,
  options: { mock?: boolean } = {},
): void {
  if (typeof window === "undefined") return
  const returnUrl = buildCallbackReturnUrl(locale)
  const path = options.mock
    ? `/auth/mock/${provider}/login`
    : `/auth/${provider}/login`
  const url = new URL(authApiUrl(path))
  url.searchParams.set("return_to", returnUrl)
  window.location.assign(url.toString())
}

export async function fetchMe(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(authApiUrl("/auth/me"), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as AuthUser
    return data
  } catch {
    return null
  }
}

export async function logoutRequest(token: string): Promise<void> {
  try {
    await fetch(authApiUrl("/auth/logout"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // logout is fire-and-forget; the client wipes its own token regardless
  }
}
