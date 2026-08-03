import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoginModal } from "@/components/auth/login-modal"

import { renderWithLocale } from "@/tests/utils"

const loginWithProvider = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    useAuth: () => ({
      status: "anonymous",
      user: null,
      loginWithProvider,
      loginAsDevUser: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue(null),
      applyLocalUser: vi.fn(),
    }),
  }
})

describe("LoginModal", () => {
  beforeEach(() => {
    loginWithProvider.mockReset().mockResolvedValue(undefined)
  })

  it("renders the sole Google provider button", () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />)
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument()
  })

  it("does not offer the dropped social providers", () => {
    // Facebook and X/Twitter were removed — Google is the only social path now.
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />)
    expect(
      screen.queryByRole("button", { name: /continue with facebook/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /continue with x/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /twitter/i }),
    ).not.toBeInTheDocument()
  })

  it("does not render Instagram, email/password fields, or a 'Maybe later' button", () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />)
    expect(
      screen.queryByRole("button", { name: /instagram/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /maybe later/i }),
    ).not.toBeInTheDocument()
    // Email + password forms were removed alongside the corresponding
    // backend endpoints — only social login remains.
    expect(
      screen.queryByRole("textbox", { name: /email/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/confirm password/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("tab", { name: /create account/i }),
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

  it("no longer hosts the dev-user control (it moved beside the header CTA)", () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />)
    expect(screen.queryByLabelText(/dev username/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /dev user/i }),
    ).not.toBeInTheDocument()
  })
})
