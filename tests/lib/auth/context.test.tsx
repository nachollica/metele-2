import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider, useAuth, type AuthUser } from "@/lib/auth"
import { TOKEN_STORAGE_KEY } from "@/lib/auth/client"

const mockUser: AuthUser = {
  id: "google:1",
  provider: "google",
  email: "x@example.com",
  name: "X",
  avatarUrl: null,
}

function Probe() {
  const { status, user, token, setSession, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user ? user.name : "(none)"}</span>
      <span data-testid="token">{token ?? "(no-token)"}</span>
      <button onClick={() => setSession("new-token", { ...mockUser, name: "Y" })}>
        login
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  )
}

describe("AuthProvider", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("starts anonymous when no token is stored", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("anonymous")
    })
    expect(screen.getByTestId("user")).toHaveTextContent("(none)")
  })

  it("hydrates the user from /auth/me when a token is stored", async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "stored-token")
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    )
    expect(screen.getByTestId("user")).toHaveTextContent("X")
    expect(screen.getByTestId("token")).toHaveTextContent("stored-token")
  })

  it("wipes a stale token when /auth/me rejects it", async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "stale")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("anonymous"),
    )
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it("setSession persists the new token and authenticates the user", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("anonymous"),
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "login" }))

    expect(screen.getByTestId("status")).toHaveTextContent("authenticated")
    expect(screen.getByTestId("user")).toHaveTextContent("Y")
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe("new-token")
  })

  it("logout wipes state and calls /auth/logout fire-and-forget", async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "abc")
    const fetchMock = vi
      .fn()
      // First call: /auth/me during boot
      .mockResolvedValueOnce({ ok: true, json: async () => mockUser })
      // Second call: /auth/logout
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    )

    const user = userEvent.setup()
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "logout" }))
    })

    expect(screen.getByTestId("status")).toHaveTextContent("anonymous")
    expect(screen.getByTestId("user")).toHaveTextContent("(none)")
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    // Two fetches: /auth/me on boot, then /auth/logout
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:8000/auth/logout")
  })

  it("useAuth throws when used outside a provider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/useAuth must be used inside/)
    error.mockRestore()
  })
})
