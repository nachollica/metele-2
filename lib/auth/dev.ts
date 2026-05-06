// Local-dev backdoor that mirrors `lib/auth/context.tsx` for the special
// "dev user" case: a hardcoded Bearer token issued by `POST /auth/dev-login`,
// validated server-side against a shared secret instead of an Auth0 JWKS.
//
// This is intentionally a thin shell around localStorage + a fetch call so
// it can be ripped out when no longer needed without unwinding the real
// auth flow.

import type { AuthUser } from "./types"
import { apiUrl } from "./client"

const TOKEN_KEY = "metele.dev.token"
const USER_KEY = "metele.dev.user"

export type DevSession = {
  token: string
  user: AuthUser
}

export function readDevSession(): DevSession | null {
  if (typeof window === "undefined") return null
  try {
    const token = window.localStorage.getItem(TOKEN_KEY)
    const userJson = window.localStorage.getItem(USER_KEY)
    if (!token || !userJson) return null
    const user = JSON.parse(userJson) as AuthUser
    return { token, user }
  } catch {
    return null
  }
}

function writeDevSession(session: DevSession): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TOKEN_KEY, session.token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user))
}

export function clearDevSession(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export async function loginDev(): Promise<DevSession | null> {
  try {
    const res = await fetch(apiUrl("/auth/dev-login"), { method: "POST" })
    if (!res.ok) {
      console.log(`[auth-dev] login failed ${res.status}`)
      return null
    }
    const data = (await res.json()) as DevSession
    writeDevSession(data)
    return data
  } catch (err) {
    console.log("[auth-dev] login unreachable", err)
    return null
  }
}
