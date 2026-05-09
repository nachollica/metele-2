import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoginModal } from "@/components/auth/login-modal"

import { renderWithLocale } from "@/tests/utils"

const loginWithProvider = vi.fn().mockResolvedValue(undefined)
const loginAsDevUser = vi.fn()

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    useAuth: () => ({
      status: "anonymous",
      user: null,
      loginWithProvider,
      loginAsDevUser,
      logout: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue(null),
      applyLocalUser: vi.fn(),
    }),
  }
})

describe("LoginModal", () => {
  beforeEach(() => {
    loginWithProvider.mockReset().mockResolvedValue(undefined)
    loginAsDevUser.mockReset()
  })

  it("renders one button per supported provider", () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />)
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /continue with facebook/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /continue with x \(twitter\)/i }),
    ).toBeInTheDocument()
  })

  it("does not render Instagram, a mock-account shortcut, or a 'Maybe later' button", () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />)
    expect(
      screen.queryByRole("button", { name: /instagram/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /mock account/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /maybe later/i }),
    ).not.toBeInTheDocument()
  })

  it("kicks off the Auth0 redirect flow when a provider button is clicked", async () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />, { locale: "en" })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    )
    expect(loginWithProvider).toHaveBeenCalledWith("google")
  })

  it("kicks off the Auth0 redirect flow for the Twitter button", async () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />, { locale: "en" })
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: /continue with x \(twitter\)/i }),
    )
    expect(loginWithProvider).toHaveBeenCalledWith("twitter")
  })

  it("collapses the dev-user input until the dev button is clicked", async () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />)
    const user = userEvent.setup()
    expect(screen.queryByLabelText(/dev username/i)).not.toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: /continue with dev user/i }),
    )
    expect(await screen.findByLabelText(/dev username/i)).toBeVisible()
  })

  it("calls loginAsDevUser with the typed username and closes on success", async () => {
    loginAsDevUser.mockResolvedValue({
      ok: true,
      session: { token: "t", user: { id: "alice" } },
    })
    const onOpenChange = vi.fn()
    renderWithLocale(<LoginModal open onOpenChange={onOpenChange} />)
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: /continue with dev user/i }),
    )
    await user.type(screen.getByLabelText(/dev username/i), "alice")
    await user.click(
      screen.getByRole("button", { name: /log in as dev user/i }),
    )
    expect(loginAsDevUser).toHaveBeenCalledWith("alice")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows the not-found error when backend returns 403", async () => {
    loginAsDevUser.mockResolvedValue({ ok: false, reason: "not_found" })
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />)
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: /continue with dev user/i }),
    )
    await user.type(screen.getByLabelText(/dev username/i), "ghost")
    await user.click(
      screen.getByRole("button", { name: /log in as dev user/i }),
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(/no dev user/i)
  })
})
