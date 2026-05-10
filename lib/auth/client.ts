"use client"

import type { AuthProvider, AuthUser } from "./types"

// Backend base URL (FastAPI). Configurable via NEXT_PUBLIC_API_URL so
// production can point at the deployed host while local dev uses the
// uvicorn default.
const API_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000"

export function apiUrl(path: string): string {
  return `${API_URL.replace(/\/+$/, "")}/api${path.startsWith("/") ? path : `/${path}`}`
}

// ---- Auth0 SPA configuration ---------------------------------------------

export type Auth0Config = {
  domain: string
  clientId: string
  audience: string
}

// Returns the Auth0 SPA config when all three vars are set. We refuse to
// render the Auth0Provider with placeholders so misconfigurations fail
// loudly rather than dumping the user into a broken login flow.
export function readAuth0Config(): Auth0Config | null {
  if (typeof process === "undefined") return null
  const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID
  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE
  if (!domain || !clientId || !audience) return null
  return { domain, clientId, audience }
}

// Map our internal provider id (used in URLs and i18n keys) to the Auth0
// social connection name that gets passed via `loginWithRedirect`.
export const AUTH0_CONNECTION: Record<AuthProvider, string> = {
  google: "google-oauth2",
  facebook: "facebook",
  twitter: "twitter",
}

// The redirect URL Auth0 should send the user back to after consent. Must
// match an Allowed Callback URL configured on the Auth0 application.
export function buildRedirectUri(): string {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/auth/callback`
}

// ---- Authenticated fetch helpers ----------------------------------------

export type TokenGetter = () => Promise<string | null>

async function authedFetch(
  token: string,
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

export async function fetchMe(token: string): Promise<AuthUser | null> {
  try {
    const res = await authedFetch(token, apiUrl("/auth/me"))
    if (!res.ok) return null
    return (await res.json()) as AuthUser
  } catch {
    return null
  }
}

// Generic helper used by the stories/words clients so they don't have to
// duplicate the bearer-injection boilerplate.
export async function apiFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return authedFetch(token, apiUrl(path), init)
}
