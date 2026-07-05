import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProfilePanel } from "@/components/flowfic/profile-panel"
import type { AuthContextValue, AuthUser } from "@/lib/auth"

import { renderWithLocale } from "@/tests/utils"

const baseUser: AuthUser = {
  id: "google-oauth2|abc",
  email: "x@example.com",
  name: "Original Name",
  avatarUrl: null,
  customPresets: [],
}

const authState: { current: AuthContextValue } = {
  current: makeAuth(),
}

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "authenticated",
    user: baseUser,
    loginWithProvider: vi.fn().mockResolvedValue(undefined),
    loginAsDevUser: vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "error" as const }),
    logout: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue("tok"),
    applyLocalUser: vi.fn(),
    ...overrides,
  }
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    useAuth: () => authState.current,
  }
})

describe("ProfilePanel", () => {
  beforeEach(() => {
    authState.current = makeAuth()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("seeds the form with the current user's name + email and shows the story count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ count: 12 }),
      }),
    )

    renderWithLocale(<ProfilePanel />)

    expect(
      (screen.getByLabelText(/display name/i) as HTMLInputElement).value,
    ).toBe("Original Name")
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe(
      "x@example.com",
    )
    await waitFor(() =>
      expect(screen.getByText("12")).toBeInTheDocument(),
    )
  })

  it("PATCHes the profile and pushes the new user into the auth context on save", async () => {
    const applyLocalUser = vi.fn()
    authState.current = makeAuth({ applyLocalUser })

    const updated = {
      id: baseUser.id,
      email: "renamed@example.com",
      name: "Renamed",
      avatarUrl: null,
    }
    const fetchMock = vi
      .fn()
      // First call: GET /stories/count.
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0 }) })
      // Second call: PATCH /profile/me.
      .mockResolvedValueOnce({ ok: true, json: async () => updated })
    vi.stubGlobal("fetch", fetchMock)

    renderWithLocale(<ProfilePanel />)

    const user = userEvent.setup()
    const nameInput = screen.getByLabelText(/display name/i)
    await user.clear(nameInput)
    await user.type(nameInput, "Renamed")
    await user.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() => {
      expect(applyLocalUser).toHaveBeenCalledWith(updated)
    })

    const patchCall = fetchMock.mock.calls[1]
    expect(patchCall?.[0]).toBe("http://localhost:8000/api/profile/me")
    expect((patchCall?.[1] as RequestInit).method).toBe("PATCH")
  })

  it("blocks save and shows an error when the email is malformed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ count: 0 }) })
    vi.stubGlobal("fetch", fetchMock)

    renderWithLocale(<ProfilePanel />)

    const user = userEvent.setup()
    const emailInput = screen.getByLabelText(/email/i)
    await user.clear(emailInput)
    await user.type(emailInput, "not-an-email")

    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeDisabled()
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i)
    // Only the initial story-count GET ran; no PATCH attempted.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
