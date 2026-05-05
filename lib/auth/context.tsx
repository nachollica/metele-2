"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  fetchMe,
  logoutRequest,
  persistToken,
  readStoredToken,
} from "./client"
import type { AuthUser } from "./types"

type AuthStatus = "loading" | "authenticated" | "anonymous"

type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  token: string | null
  // Persist a freshly issued session (called from the OAuth callback page).
  setSession: (token: string, user: AuthUser) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("loading")

  // Boot: read any persisted token, validate it against /auth/me. If the token
  // is rejected we wipe it so the UI lands in "anonymous" without a stale user.
  useEffect(() => {
    let cancelled = false
    const stored = readStoredToken()
    if (!stored) {
      setStatus("anonymous")
      return
    }
    setToken(stored)
    fetchMe(stored).then((me) => {
      if (cancelled) return
      if (me) {
        setUser(me)
        setStatus("authenticated")
      } else {
        persistToken(null)
        setToken(null)
        setStatus("anonymous")
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    persistToken(nextToken)
    setToken(nextToken)
    setUser(nextUser)
    setStatus("authenticated")
  }, [])

  const logout = useCallback(async () => {
    const current = token
    persistToken(null)
    setToken(null)
    setUser(null)
    setStatus("anonymous")
    if (current) await logoutRequest(current)
  }, [token])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, token, setSession, logout }),
    [status, user, token, setSession, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>")
  }
  return ctx
}
