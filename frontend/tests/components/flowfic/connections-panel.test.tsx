import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ConnectionsPanel } from "@/components/flowfic/connections-panel"
import type { AuthContextValue } from "@/lib/auth"

import { renderWithLocale } from "@/tests/utils"

const authState: { current: AuthContextValue } = { current: makeAuth() }

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "authenticated",
    user: {
      id: "google-oauth2|abc",
      email: "x@example.com",
      name: "Me",
      avatarUrl: null,
      customPresets: [],
    },
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

type FakeConnection = { user: { id: string; name: string; avatarUrl: string | null }; connectedAt: string }

// A tiny in-memory fake of the `/connections` backend, keyed by URL + method,
// so the component is exercised against the real `connections-api.ts` client
// rather than a mocked hook — the same style `profile-panel.test.tsx` uses for
// `updateProfile`.
function stubBackend(initialConnections: FakeConnection[] = []) {
  let inviteToken: string | null = null
  let connections = initialConnections
  let counter = 0

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url.endsWith("/connections/invite") && method === "GET") {
      return { ok: true, json: async () => ({ token: inviteToken }) }
    }
    if (url.endsWith("/connections/invite") && method === "POST") {
      counter += 1
      inviteToken = `invite-token-${counter}`
      return { ok: true, json: async () => ({ token: inviteToken }) }
    }
    if (url.endsWith("/connections/invite") && method === "DELETE") {
      inviteToken = null
      return { ok: true }
    }
    if (url.endsWith("/connections") && method === "GET") {
      return { ok: true, json: async () => connections }
    }
    const removeMatch = /\/connections\/([^/]+)$/.exec(url)
    if (removeMatch && method === "DELETE") {
      connections = connections.filter((c) => c.user.id !== removeMatch[1])
      return { ok: true }
    }
    throw new Error(`Unhandled request: ${method} ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  authState.current = makeAuth()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("ConnectionsPanel", () => {
  it("offers to create an invite link when none exists", async () => {
    stubBackend()
    renderWithLocale(<ConnectionsPanel />)
    expect(await screen.findByRole("button", { name: "Create invite link" })).toBeInTheDocument()
  })

  it("creates an invite link and shows it with copy/regenerate/disable controls", async () => {
    stubBackend()
    const user = userEvent.setup()
    renderWithLocale(<ConnectionsPanel />)

    await user.click(await screen.findByRole("button", { name: "Create invite link" }))

    const input = await screen.findByRole("textbox", { name: "Your invite link" })
    expect(input).toHaveValue("http://localhost:3000/connect/invite-token-1")
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Disable" })).toBeInTheDocument()
  })

  it("copies the invite link and shows an inline confirmation", async () => {
    stubBackend()
    // `userEvent.setup()` installs its own clipboard stub on `navigator`
    // (a getter-based property, unconditionally, every call) — spying has to
    // happen after that setup call, or this replaces a stub that gets
    // immediately overwritten again.
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    renderWithLocale(<ConnectionsPanel />)
    await user.click(await screen.findByRole("button", { name: "Create invite link" }))

    await user.click(screen.getByRole("button", { name: "Copy link" }))

    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/connect/invite-token-1")
    expect(await screen.findByRole("status")).toHaveTextContent("Copied.")
  })

  it("regenerates the link, replacing the token", async () => {
    stubBackend()
    const user = userEvent.setup()
    renderWithLocale(<ConnectionsPanel />)
    await user.click(await screen.findByRole("button", { name: "Create invite link" }))
    await screen.findByDisplayValue("http://localhost:3000/connect/invite-token-1")

    await user.click(screen.getByRole("button", { name: "Regenerate" }))

    await screen.findByDisplayValue("http://localhost:3000/connect/invite-token-2")
  })

  it("disables the invite link after confirming", async () => {
    stubBackend()
    const user = userEvent.setup()
    renderWithLocale(<ConnectionsPanel />)
    await user.click(await screen.findByRole("button", { name: "Create invite link" }))
    await screen.findByRole("textbox", { name: "Your invite link" })

    await user.click(screen.getByRole("button", { name: "Disable" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Disable" }))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create invite link" })).toBeInTheDocument(),
    )
  })

  it("shows the empty hint when there are no connections", async () => {
    stubBackend([])
    renderWithLocale(<ConnectionsPanel />)
    expect(
      await screen.findByText(
        "You have no connections yet. Share your invite link to connect with others.",
      ),
    ).toBeInTheDocument()
  })

  it("lists existing connections and removes one after confirming", async () => {
    stubBackend([
      { user: { id: "u2", name: "Bob", avatarUrl: null }, connectedAt: "2026-01-01T00:00:00Z" },
    ])
    const user = userEvent.setup()
    renderWithLocale(<ConnectionsPanel />)

    expect(await screen.findByText("Bob")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Remove Bob" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(screen.queryByText("Bob")).not.toBeInTheDocument())
    expect(
      await screen.findByText(
        "You have no connections yet. Share your invite link to connect with others.",
      ),
    ).toBeInTheDocument()
  })
})
