import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AuthButton } from "@/components/auth/auth-button"
import type { AuthContextValue } from "@/lib/auth"

import { renderWithLocale } from "@/tests/utils"

const authState: { current: AuthContextValue } = {
  current: makeAnonymous(),
}

function makeAnonymous(): AuthContextValue {
  return {
    status: "anonymous",
    user: null,
    loginWithProvider: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue(null),
    applyLocalUser: vi.fn(),
    loginAsDevUser: vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "error" as const }),
  }
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    useAuth: () => authState.current,
  }
})

describe("AuthButton", () => {
  beforeEach(() => {
    authState.current = makeAnonymous()
  })

  it("renders a 'Log in' button when anonymous", async () => {
    renderWithLocale(<AuthButton />)
    expect(
      await screen.findByRole("button", { name: /log in/i }),
    ).toBeInTheDocument()
  })

  it("opens the login modal when clicked while anonymous", async () => {
    renderWithLocale(<AuthButton />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /log in/i }))
    expect(
      await screen.findByRole("dialog", { name: /sign in to metele/i }),
    ).toBeInTheDocument()
  })

  it("renders the user's name and account menu when authenticated", () => {
    authState.current = {
      ...makeAnonymous(),
      status: "authenticated",
      user: {
        id: "google-oauth2|abc",
        email: "x@example.com",
        name: "Jane Doe",
        avatarUrl: null,
        customPresets: [],
      },
    }
    renderWithLocale(<AuthButton />)

    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /account menu/i }),
    ).toBeInTheDocument()
  })

  it("calls logout when the menu's 'Log out' is clicked", async () => {
    const logout = vi.fn()
    authState.current = {
      ...makeAnonymous(),
      status: "authenticated",
      user: {
        id: "google-oauth2|abc",
        email: null,
        name: "Jane Doe",
        avatarUrl: null,
        customPresets: [],
      },
      logout,
    }
    renderWithLocale(<AuthButton />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /account menu/i }))
    await user.click(await screen.findByRole("menuitem", { name: /log out/i }))
    expect(logout).toHaveBeenCalledOnce()
  })

  it("uses Spanish translations under the 'es' locale", async () => {
    renderWithLocale(<AuthButton />, { locale: "es" })
    expect(
      await screen.findByRole("button", { name: /iniciar sesi[oó]n/i }),
    ).toBeInTheDocument()
  })
})
