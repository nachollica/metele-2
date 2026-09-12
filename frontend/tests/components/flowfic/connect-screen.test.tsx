import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ConnectScreen } from "@/components/flowfic/connect-screen"
import type { AuthContextValue, AuthUser } from "@/lib/auth"

import { renderWithLocale } from "@/tests/utils"

const authState: { current: AuthContextValue } = { current: makeAuth() }

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "anonymous",
    user: null,
    loginWithProvider: vi.fn().mockResolvedValue(undefined),
    loginAsDevUser: vi.fn().mockResolvedValue({ ok: false, reason: "error" as const }),
    logout: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue("tok"),
    applyLocalUser: vi.fn(),
    ...overrides,
  }
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return { ...actual, useAuth: () => authState.current }
})

const api = vi.hoisted(() => ({
  fetchInvitePreview: vi.fn(),
  acceptInvite: vi.fn(),
}))
vi.mock("@/lib/flowfic/connections-api", () => api)

const pendingInvite = vi.hoisted(() => ({ writePendingInvite: vi.fn() }))
vi.mock("@/lib/flowfic/pending-invite", () => pendingInvite)

const ALICE = { id: "u-alice", name: "Alice", avatarUrl: null }
const ALICE_AUTH_USER: AuthUser = { ...ALICE, email: null, customPresets: [] }

beforeEach(() => {
  authState.current = makeAuth()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("ConnectScreen", () => {
  it("shows a spinner while the invite preview loads", () => {
    api.fetchInvitePreview.mockReturnValue(new Promise(() => {})) // never resolves
    renderWithLocale(<ConnectScreen token="tok1" onBackHome={vi.fn()} onOpenProfile={vi.fn()} />)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("shows an invalid-link message when the token doesn't resolve", async () => {
    api.fetchInvitePreview.mockResolvedValue(null)
    const onBackHome = vi.fn()
    const user = userEvent.setup()
    renderWithLocale(<ConnectScreen token="bad" onBackHome={onBackHome} onOpenProfile={vi.fn()} />)

    expect(await screen.findByText("This invite link isn't valid")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Back to home" }))
    expect(onBackHome).toHaveBeenCalledTimes(1)
  })

  it("shows an own-link message when the caller opens their own invite", async () => {
    api.fetchInvitePreview.mockResolvedValue(ALICE)
    authState.current = makeAuth({ status: "authenticated", user: ALICE_AUTH_USER })
    renderWithLocale(<ConnectScreen token="tok1" onBackHome={vi.fn()} onOpenProfile={vi.fn()} />)

    expect(await screen.findByText("This is your own invite link")).toBeInTheDocument()
  })

  it("offers a sign-in for an anonymous visitor, writing the pending invite before redirecting", async () => {
    api.fetchInvitePreview.mockResolvedValue(ALICE)
    const user = userEvent.setup()
    renderWithLocale(<ConnectScreen token="tok1" onBackHome={vi.fn()} onOpenProfile={vi.fn()} />)

    expect(await screen.findByText("Alice invited you to connect on Flowfic.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Sign in to connect" }))

    expect(
      screen.getByText("Sign in or create an account to connect with Alice."),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /continue with google/i }))

    expect(pendingInvite.writePendingInvite).toHaveBeenCalledWith("tok1")
    expect(authState.current.loginWithProvider).toHaveBeenCalledWith("google")
  })

  it("connects an authenticated visitor and offers to view the connections list", async () => {
    api.fetchInvitePreview.mockResolvedValue(ALICE)
    api.acceptInvite.mockResolvedValue({ user: ALICE, connectedAt: "2026-01-01T00:00:00Z" })
    authState.current = makeAuth({ status: "authenticated" })
    const onOpenProfile = vi.fn()
    const user = userEvent.setup()
    renderWithLocale(
      <ConnectScreen token="tok1" onBackHome={vi.fn()} onOpenProfile={onOpenProfile} />,
    )

    await user.click(await screen.findByRole("button", { name: "Connect with Alice" }))

    expect(await screen.findByText("You're now connected with Alice.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Go to your connections" }))
    expect(onOpenProfile).toHaveBeenCalledTimes(1)
  })

  it("shows an inline error and keeps the button available to retry on failure", async () => {
    api.fetchInvitePreview.mockResolvedValue(ALICE)
    api.acceptInvite.mockResolvedValue(null)
    authState.current = makeAuth({ status: "authenticated" })
    const user = userEvent.setup()
    renderWithLocale(<ConnectScreen token="tok1" onBackHome={vi.fn()} onOpenProfile={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: "Connect with Alice" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't connect. Try again.")
    expect(screen.getByRole("button", { name: "Connect with Alice" })).toBeInTheDocument()
  })

  it("waits for auth to settle before deciding which shape to show", () => {
    api.fetchInvitePreview.mockResolvedValue(ALICE)
    authState.current = makeAuth({ status: "loading" })
    renderWithLocale(<ConnectScreen token="tok1" onBackHome={vi.fn()} onOpenProfile={vi.fn()} />)
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /connect|sign in/i })).not.toBeInTheDocument()
  })
})
