"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  Auth0Provider as Auth0SDKProvider,
  useAuth0,
  type AppState,
} from "@auth0/auth0-react"

import { useLocale } from "@/lib/i18n"

import {
  AUTH0_CONNECTION,
  buildRedirectUri,
  readAuth0Config,
} from "./client"
import type { AuthProvider as AuthProviderId, AuthUser } from "./types"

type AuthStatus = "loading" | "authenticated" | "anonymous"

export type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  // Kicks off a redirect-based login against Auth0 for the chosen social
  // connection. Returns the user to the configured callback URL.
  loginWithProvider: (provider: AuthProviderId) => Promise<void>
  logout: () => void
  // Resolves to a fresh API access token, or null if the user is anonymous
  // / Auth0 is unreachable. Used by the stories/words clients.
  getAccessToken: () => Promise<string | null>
  // Override the locally-displayed user record. Called by the profile screen
  // after a successful PATCH so the avatar/name shown in the header match the
  // saved values without waiting for an Auth0 token refresh.
  applyLocalUser: (user: AuthUser) => void
}

// Context for fields that aren't part of the upstream Auth0 SDK — currently
// just the locally-overridden user record after a profile edit.
type LocalAuthState = {
  override: AuthUser | null
  setOverride: (user: AuthUser) => void
}

const LocalAuthContext = createContext<LocalAuthState | null>(null)

// ---- Provider ------------------------------------------------------------

// `AuthProvider` is mounted inside `app/[lang]/layout.tsx`. We can't read
// the locale from context at module load time, so the inner provider reads
// it from `useLocale` and the outer wrapper just forwards children when
// Auth0 isn't configured.
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
  const value = useMemo<LocalAuthState>(
    () => ({ override, setOverride }),
    [override],
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
  const locale = useLocale()
  const redirectUri = buildRedirectUri(locale)

  // After the SDK exchanges the code on the callback page, bounce the user
  // to the home route for their locale (or wherever they came from).
  const onRedirectCallback = useCallback(
    (appState?: AppState) => {
      if (typeof window === "undefined") return
      const target =
        (appState?.returnTo as string | undefined) ?? `/${locale}`
      window.location.replace(target)
    },
    [locale],
  )

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
      <LocalAuthProvider>{children}</LocalAuthProvider>
    </Auth0SDKProvider>
  )
}

// ---- Hook ----------------------------------------------------------------

// Adapter shape that hides @auth0/auth0-react behind our project's API.
// Components only ever import `useAuth` from `@/lib/auth`.
export function useAuth(): AuthContextValue {
  const locale = useLocale()
  const a0 = useAuth0()
  const local = useContext(LocalAuthContext)

  const loginWithProvider = useCallback(
    async (provider: AuthProviderId) => {
      await a0.loginWithRedirect({
        authorizationParams: {
          connection: AUTH0_CONNECTION[provider],
          redirect_uri: buildRedirectUri(locale),
        },
        appState: { returnTo: `/${locale}` },
      })
    },
    [a0, locale],
  )

  const logout = useCallback(() => {
    a0.logout({
      logoutParams: {
        returnTo:
          typeof window === "undefined" ? "" : `${window.location.origin}/${locale}`,
      },
    })
  }, [a0, locale])

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!a0.isAuthenticated) return null
    try {
      return await a0.getAccessTokenSilently()
    } catch {
      // Refresh failed (network error, token revoked, etc.) — caller
      // treats null as "anonymous" and falls back accordingly.
      return null
    }
  }, [a0])

  const sdkUser: AuthUser | null = useMemo(() => {
    const u = a0.user
    if (!u || !u.sub) return null
    return {
      id: u.sub,
      name: u.name ?? u.email ?? u.sub,
      email: u.email ?? null,
      avatarUrl: u.picture ?? null,
    }
  }, [a0.user])

  // Local override (set by ProfilePanel after a successful save) takes
  // precedence over the SDK's copy so the header reflects edits before a
  // token refresh would replace them.
  const user: AuthUser | null = local?.override ?? sdkUser

  const applyLocalUser = useCallback(
    (next: AuthUser) => {
      local?.setOverride(next)
    },
    [local],
  )

  const status: AuthStatus = a0.isLoading
    ? "loading"
    : a0.isAuthenticated
      ? "authenticated"
      : "anonymous"

  return useMemo(
    () => ({
      status,
      user,
      loginWithProvider,
      logout,
      getAccessToken,
      applyLocalUser,
    }),
    [status, user, loginWithProvider, logout, getAccessToken, applyLocalUser],
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
