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

// Opened to keep a story rather than to log in: the header is overridden and a
// secondary way out appears, behind a confirmation.
describe("LoginModal opened to save a story", () => {
  beforeEach(() => {
    loginWithProvider.mockReset().mockResolvedValue(undefined)
  })

  it("uses the supplied header instead of the generic sign-in copy", () => {
    renderWithLocale(
      <LoginModal
        open
        onOpenChange={() => {}}
        title="Sign in to save this story"
        description="Nowhere to keep it yet."
      />,
    )
    expect(
      screen.getByRole("heading", { name: /sign in to save this story/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: /sign in to flowfic/i })).not.toBeInTheDocument()
  })

  it("shows no way out when there is nothing to discard", () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />)
    expect(screen.queryByRole("button", { name: /return to home page/i })).not.toBeInTheDocument()
  })

  it("asks for confirmation before discarding, and announces the new step", async () => {
    const onDiscard = vi.fn()
    renderWithLocale(
      <LoginModal
        open
        onOpenChange={() => {}}
        onDiscard={onDiscard}
        discardLabel="Return to home page"
      />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /return to home page/i }))

    // The dialog renames itself, so the confirmation reaches assistive tech
    // rather than silently changing what the buttons do.
    expect(screen.getByRole("heading", { name: /lose this story\?/i })).toBeInTheDocument()
    expect(onDiscard).not.toHaveBeenCalled()
    // The sign-in options are out of the way while the question is up.
    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).not.toBeInTheDocument()
  })

  it("discards only from the confirm button", async () => {
    const onDiscard = vi.fn()
    renderWithLocale(
      <LoginModal open onOpenChange={() => {}} onDiscard={onDiscard} discardLabel="Leave" />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /leave/i }))
    await user.click(screen.getByRole("button", { name: /discard the story/i }))

    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it("backs out of the confirmation without discarding", async () => {
    const onDiscard = vi.fn()
    renderWithLocale(
      <LoginModal open onOpenChange={() => {}} onDiscard={onDiscard} discardLabel="Leave" />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /leave/i }))
    await user.click(screen.getByRole("button", { name: /keep my story/i }))

    expect(onDiscard).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument()
  })

  it("Escape during the confirmation backs out one level, not two", async () => {
    const onOpenChange = vi.fn()
    const onDiscard = vi.fn()
    renderWithLocale(
      <LoginModal open onOpenChange={onOpenChange} onDiscard={onDiscard} discardLabel="Leave" />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /leave/i }))
    await user.keyboard("{Escape}")

    // Back on the sign-in step, with the modal still open and the story intact.
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onDiscard).not.toHaveBeenCalled()
  })

  it("runs onBeforeLogin before handing over to the redirect", async () => {
    const calls: string[] = []
    loginWithProvider.mockImplementation(async () => {
      calls.push("login")
    })
    renderWithLocale(
      <LoginModal open onOpenChange={() => {}} onBeforeLogin={() => calls.push("before")} />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /continue with google/i }))

    // The document is about to be replaced; anything not written down by now
    // is gone.
    expect(calls).toEqual(["before", "login"])
  })
})
