import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AuthButton } from "@/components/auth/auth-button"
import type { AuthContextValue } from "@/lib/auth"
import type { BackendStatus, BackendStatusValue } from "@/lib/backend"

import { renderWithLocale } from "@/tests/utils"

const authState: { current: AuthContextValue } = {
  current: makeAnonymous(),
}

// Controls what the embedded useBackendStatus() reports. Defaults to a
// reachable backend with the dev backdoor off, so the baseline assertions see
// only the real "Log in" CTA.
const backendState: { current: BackendStatusValue } = {
  current: makeBackend("reachable", false),
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

function makeBackend(
  status: BackendStatus,
  devUserEnabled: boolean,
): BackendStatusValue {
  return { status, info: null, devUserEnabled, refresh: () => {} }
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    useAuth: () => authState.current,
  }
})

vi.mock("@/lib/backend", () => ({
  useBackendStatus: () => backendState.current,
}))

describe("AuthButton", () => {
  beforeEach(() => {
    authState.current = makeAnonymous()
    backendState.current = makeBackend("reachable", false)
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
      await screen.findByRole("dialog", { name: /sign in to flowfic/i }),
    ).toBeInTheDocument()
  })

  it("renders the user's display name + account menu when authenticated", () => {
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

    // Display name is the primary label — email is intentionally NOT
    // surfaced anywhere a third party could see it.
    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0)
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

  it("shows the dev login button to the left of 'Log in' when the backend reports it enabled", async () => {
    backendState.current = makeBackend("reachable", true)
    renderWithLocale(<AuthButton />)

    const devButton = await screen.findByRole("button", {
      name: /dev user login/i,
    })
    const loginButton = screen.getByRole("button", { name: /^log in$/i })
    // Dev button precedes the CTA in the DOM, i.e. sits to its left.
    expect(
      devButton.compareDocumentPosition(loginButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("hides the dev login button when the backend reports it disabled", async () => {
    renderWithLocale(<AuthButton />)
    await screen.findByRole("button", { name: /^log in$/i })
    expect(
      screen.queryByRole("button", { name: /dev user login/i }),
    ).not.toBeInTheDocument()
  })

  it("never shows the dev login button once authenticated", () => {
    backendState.current = makeBackend("reachable", true)
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
    }
    renderWithLocale(<AuthButton />)
    expect(
      screen.queryByRole("button", { name: /dev user login/i }),
    ).not.toBeInTheDocument()
  })

  it("renders only the skeleton while the backend status is unknown", async () => {
    backendState.current = makeBackend("unknown", false)
    renderWithLocale(<AuthButton />)
    // Nothing actionable yet — no auth control of any kind.
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("hides the auth control entirely when the backend is unreachable (anonymous)", () => {
    backendState.current = makeBackend("unreachable", false)
    renderWithLocale(<AuthButton />)
    expect(
      screen.queryByRole("button", { name: /log in/i }),
    ).not.toBeInTheDocument()
  })

  it("hides the avatar mid-session when the backend becomes unreachable", () => {
    backendState.current = makeBackend("unreachable", false)
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
    }
    renderWithLocale(<AuthButton />)
    expect(
      screen.queryByRole("button", { name: /account menu/i }),
    ).not.toBeInTheDocument()
  })
})
