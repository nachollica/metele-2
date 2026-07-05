import { render, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Hoisted spies so the (hoisted) vi.mock factories below can close over them.
const { getAccessTokenSilently, fetchMeSpy } = vi.hoisted(() => ({
  getAccessTokenSilently: vi.fn(),
  fetchMeSpy: vi.fn(),
}))

// Replace the Auth0 SDK with a passthrough provider and a controllable hook:
// the session is reported as authenticated so AuthBootstrap's effect fires.
vi.mock("@auth0/auth0-react", () => ({
  Auth0Provider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth0: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { sub: "google-oauth2|abc", name: "Jane" },
    getAccessTokenSilently,
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
  }),
}))

// Keep the real client (so readAuth0Config works) but spy on the /auth/me call.
vi.mock("@/lib/auth/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/client")>("@/lib/auth/client")
  return { ...actual, fetchMe: fetchMeSpy }
})

import { AuthProvider } from "@/lib/auth/context"

describe("AuthBootstrap", () => {
  beforeEach(() => {
    getAccessTokenSilently.mockReset().mockResolvedValue("token-123")
    // Return a FRESH object per call. This mirrors the real JSON.parse: a
    // dependency regression that re-runs the effect shows up as repeated
    // calls, because React would otherwise bail out of a same-reference
    // state update and mask the loop.
    fetchMeSpy.mockReset().mockImplementation(async () => ({
      id: "google-oauth2|abc",
      name: "Jane",
      email: null,
      avatarUrl: null,
      customPresets: [],
    }))
    // readAuth0Config (real) needs all three vars to mount the configured
    // provider — and therefore AuthBootstrap.
    vi.stubEnv("NEXT_PUBLIC_AUTH0_DOMAIN", "test.auth0.com")
    vi.stubEnv("NEXT_PUBLIC_AUTH0_CLIENT_ID", "test-client")
    vi.stubEnv("NEXT_PUBLIC_AUTH0_AUDIENCE", "https://api.test")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("fetches /auth/me exactly once when authenticated (no polling loop)", async () => {
    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    )

    await waitFor(() => expect(fetchMeSpy).toHaveBeenCalledTimes(1))
    // Let any stray effect re-run fire, then confirm the overlay fetch did
    // not turn into a poll. Broad effect deps (the whole useAuth0 / local
    // context value) regress to a /auth/me-per-render loop right here.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchMeSpy).toHaveBeenCalledTimes(1)
  })
})
