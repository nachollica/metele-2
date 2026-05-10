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
  Auth0Provider as Auth0SDKProvider,
  useAuth0,
  type AppState,
} from "@auth0/auth0-react"

import {
  AUTH0_CONNECTION,
  buildRedirectUri,
  fetchMe,
  readAuth0Config,
} from "./client"
import {
  clearDevSession,
  loginDev,
  readDevSession,
  type DevLoginResult,
  type DevSession,
} from "./dev"
import type { AuthProvider as AuthProviderId, AuthUser } from "./types"

type AuthStatus = "loading" | "authenticated" | "anonymous"

export type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  // Kicks off a redirect-based login against Auth0 for the chosen social
  // connection. Returns the user to the configured callback URL.
  loginWithProvider: (provider: AuthProviderId) => Promise<void>
  // Local-dev backdoor: hits `POST /auth/dev-login` for the given username
  // and stores the returned token. Returns a discriminated result so the
  // caller can distinguish "user not in DB" (403) from network errors.
  loginAsDevUser: (username: string) => Promise<DevLoginResult>
  logout: () => void
  // Resolves to a fresh API access token, or null if the user is anonymous
  // / Auth0 is unreachable. Used by the stories/words clients.
  getAccessToken: () => Promise<string | null>
  // Override the locally-displayed user record. Called by the profile screen
  // after a successful PATCH so the avatar/name shown in the header match the
  // saved values without waiting for an Auth0 token refresh.
  applyLocalUser: (user: AuthUser | null) => void
}

// Context for fields that aren't part of the upstream Auth0 SDK:
//   - `override`: locally-edited copy of the current user.
//   - `dev`: active dev-user session (hardcoded-token backdoor).
type LocalAuthState = {
  override: AuthUser | null
  setOverride: (user: AuthUser | null) => void
  dev: DevSession | null
  setDev: (session: DevSession | null) => void
}

const LocalAuthContext = createContext<LocalAuthState | null>(null)

// ---- Provider ------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const config = readAuth0Config()
  if (!config) {
    // Render children without Auth0 wrapping so the rest of the app still
    // boots in dev environments without Auth0 credentials. `useAuth` will
    // surface "anonymous" until config is supplied.
    return <UnconfiguredAuthShell>{children}</UnconfiguredAuthShell>
  }
  return <ConfiguredAuthProvider config={config}>{children}</ConfiguredAuthProvider>
}

function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<AuthUser | null>(null)
  // Read the dev session in a post-mount effect rather than as the
  // useState initializer: the SSR render has no localStorage and would
  // otherwise diverge from the client's first render, tripping the
  // hydration mismatch check.
  const [dev, setDev] = useState<DevSession | null>(null)
  useEffect(() => {
    const stored = readDevSession()
    if (stored !== null) setDev(stored)
  }, [])
  const value = useMemo<LocalAuthState>(
    () => ({ override, setOverride, dev, setDev }),
    [override, dev],
  )
  return <LocalAuthContext value={value}>{children}</LocalAuthContext>
}

function ConfiguredAuthProvider({
  config,
  children,
}: {
  config: { domain: string; clientId: string; audience: string }
  children: ReactNode
}) {
  const redirectUri = buildRedirectUri()

  // After the SDK exchanges the code on the callback page, bounce the user
  // back to the home route (or wherever they came from).
  const onRedirectCallback = useCallback((appState?: AppState) => {
    if (typeof window === "undefined") return
    const target = (appState?.returnTo as string | undefined) ?? "/"
    window.location.replace(target)
  }, [])

  return (
    <Auth0SDKProvider
      domain={config.domain}
      clientId={config.clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: config.audience,
        scope: "openid profile email",
      }}
      // localStorage + refresh-token rotation is the recommended SPA setup
      // for static deployments where iframe silent auth is unreliable
      // (third-party cookie blocking). The refresh token is short-lived
      // and rotated on every use.
      cacheLocation="localstorage"
      useRefreshTokens={true}
      onRedirectCallback={onRedirectCallback}
    >
      <LocalAuthProvider>
        <AuthBootstrap />
        {children}
      </LocalAuthProvider>
    </Auth0SDKProvider>
  )
}

// Pull the canonical user record from `/auth/me` once Auth0 has issued a
// token. Auth0 only knows about its own profile fields — app-specific data
// like the user's custom presets lives on our backend, so we overlay the
// SDK user with the row from the DB. Runs once per token refresh.
function AuthBootstrap() {
  const a0 = useAuth0()
  const local = useContext(LocalAuthContext)
  useEffect(() => {
    if (!a0.isAuthenticated || !local) return
    let cancelled = false
    void (async () => {
      try {
        const token = await a0.getAccessTokenSilently()
        if (cancelled) return
        const user = await fetchMe(token)
        if (cancelled || user === null) return
        local.setOverride(user)
      } catch {
        // Silent fall-through: components see the SDK user with empty
        // customPresets until the next refresh succeeds.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [a0, local])
  return null
}

// ---- Hook ----------------------------------------------------------------

// Adapter shape that hides @auth0/auth0-react behind our project's API.
// Components only ever import `useAuth` from `@/lib/auth`.
export function useAuth(): AuthContextValue {
  const a0 = useAuth0()
  const local = useContext(LocalAuthContext)
  const devSession = local?.dev ?? null

  const loginWithProvider = useCallback(
    async (provider: AuthProviderId) => {
      await a0.loginWithRedirect({
        authorizationParams: {
          connection: AUTH0_CONNECTION[provider],
          redirect_uri: buildRedirectUri(),
        },
        appState: { returnTo: "/" },
      })
    },
    [a0],
  )

  const loginAsDevUser = useCallback(
    async (username: string): Promise<DevLoginResult> => {
      const result = await loginDev(username)
      if (result.ok) {
        local?.setDev(result.session)
      }
      return result
    },
    [local],
  )

  const logout = useCallback(() => {
    if (devSession !== null) {
      // Dev user has no Auth0 session to revoke — just drop the local
      // token and reload to land in the anonymous state.
      clearDevSession()
      local?.setDev(null)
      local?.setOverride(null)
      return
    }
    a0.logout({
      logoutParams: {
        returnTo:
          typeof window === "undefined" ? "" : `${window.location.origin}/`,
      },
    })
  }, [a0, devSession, local])

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (devSession !== null) return devSession.token
    if (!a0.isAuthenticated) return null
    try {
      return await a0.getAccessTokenSilently()
    } catch {
      // Refresh failed (network error, token revoked, etc.) — caller
      // treats null as "anonymous" and falls back accordingly.
      return null
    }
  }, [a0, devSession])

  const sdkUser: AuthUser | null = useMemo(() => {
    const u = a0.user
    if (!u || !u.sub) return null
    return {
      id: u.sub,
      name: u.name ?? u.email ?? u.sub,
      email: u.email ?? null,
      avatarUrl: u.picture ?? null,
      // SDK doesn't carry app-specific fields. Components that need the
      // current customPresets list should fetch `/auth/me` and call
      // `applyLocalUser` so the overlay covers it.
      customPresets: [],
    }
  }, [a0.user])

  // Resolution order: local override > dev session > Auth0 SDK.
  // Local override wins so a profile edit shows up immediately; dev
  // session provides the user shape when no Auth0 SDK user exists.
  const user: AuthUser | null =
    local?.override ?? devSession?.user ?? sdkUser

  const applyLocalUser = useCallback(
    (next: AuthUser | null) => {
      local?.setOverride(next)
    },
    [local],
  )

  const status: AuthStatus =
    devSession !== null
      ? "authenticated"
      : a0.isLoading
        ? "loading"
        : a0.isAuthenticated
          ? "authenticated"
          : "anonymous"

  return useMemo(
    () => ({
      status,
      user,
      loginWithProvider,
      loginAsDevUser,
      logout,
      getAccessToken,
      applyLocalUser,
    }),
    [
      status,
      user,
      loginWithProvider,
      loginAsDevUser,
      logout,
      getAccessToken,
      applyLocalUser,
    ],
  )
}

// ---- Anonymous fallback shell -------------------------------------------

// Used when Auth0 env vars are missing — exposes the same context shape but
// always reports "anonymous" so the rest of the app renders without
// crashing on `useAuth`.
function UnconfiguredAuthShell({ children }: { children: ReactNode }) {
  return (
    <UnconfiguredAuth0Stub>
      <LocalAuthProvider>{children}</LocalAuthProvider>
    </UnconfiguredAuth0Stub>
  )
}

// Render a tiny mock that satisfies @auth0/auth0-react's context contract.
// Easier than re-implementing every hook: we just mount the real Provider
// with throw-away values; without `audience`/`clientId` valid the SDK
// won't actually attempt token issuance and `useAuth0` reports
// `isAuthenticated=false` after the initial load.
function UnconfiguredAuth0Stub({ children }: { children: ReactNode }) {
  return (
    <Auth0SDKProvider
      domain="placeholder.invalid"
      clientId="placeholder"
      authorizationParams={{
        redirect_uri:
          typeof window === "undefined" ? "" : window.location.origin,
      }}
      cacheLocation="memory"
    >
      {children}
    </Auth0SDKProvider>
  )
}
