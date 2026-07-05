import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DevLoginButton } from "@/components/auth/dev-login-button"

import { renderWithLocale } from "@/tests/utils"

// Visibility now lives in AuthButton (driven by the backend /ping flag), so
// here we only exercise the button's own behavior: it always renders its
// trigger and drives the dev-login flow.
const loginAsDevUser = vi.fn()

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    useAuth: () => ({
      status: "anonymous",
      user: null,
      loginWithProvider: vi.fn(),
      loginAsDevUser,
      logout: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue(null),
      applyLocalUser: vi.fn(),
    }),
  }
})

describe("DevLoginButton", () => {
  beforeEach(() => {
    loginAsDevUser.mockReset()
  })

  it("renders the dev icon button, collapsed by default", () => {
    renderWithLocale(<DevLoginButton />)
    expect(
      screen.getByRole("button", { name: /dev user login/i }),
    ).toBeInTheDocument()
    // No username field until the button is clicked.
    expect(screen.queryByLabelText(/dev username/i)).not.toBeInTheDocument()
  })

  it("opens the popover and logs in with the typed username", async () => {
    loginAsDevUser.mockResolvedValue({
      ok: true,
      session: { token: "t", user: { id: "alice" } },
    })
    renderWithLocale(<DevLoginButton />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /dev user login/i }))
    await user.type(await screen.findByLabelText(/dev username/i), "alice")
    await user.click(screen.getByRole("button", { name: /log in as dev user/i }))

    expect(loginAsDevUser).toHaveBeenCalledWith("alice")
  })

  it("shows the not-found error when the backend returns 403", async () => {
    loginAsDevUser.mockResolvedValue({ ok: false, reason: "not_found" })
    renderWithLocale(<DevLoginButton />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /dev user login/i }))
    await user.type(await screen.findByLabelText(/dev username/i), "ghost")
    await user.click(screen.getByRole("button", { name: /log in as dev user/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/no dev user/i)
  })

  it("is disabled when the host locks the UI", () => {
    renderWithLocale(<DevLoginButton disabled />)
    expect(screen.getByRole("button", { name: /dev user login/i })).toBeDisabled()
  })
})
