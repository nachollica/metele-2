import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AppHeader } from "@/components/flowfic/app-header"
import type { AuthContextValue, AuthUser } from "@/lib/auth"

import { renderWithLocale } from "@/tests/utils"

const baseUser: AuthUser = {
  id: "dev|1",
  email: null,
  name: "Tester",
  avatarUrl: null,
  customPresets: [],
}

const authState: { current: AuthContextValue } = { current: makeAuth() }

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "authenticated",
    user: baseUser,
    loginWithProvider: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue("tok"),
    applyLocalUser: vi.fn(),
    loginAsDevUser: vi.fn().mockResolvedValue({ ok: false, reason: "error" as const }),
    ...overrides,
  }
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return { ...actual, useAuth: () => authState.current }
})

vi.mock("@/lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/lib/backend")>("@/lib/backend")
  return { ...actual, useBackendStatus: () => ({ reachable: true, devUserEnabled: false }) }
})

// The bar mounts the language menu and the theme toggle, which read the
// preferences store. Same stub the two of them use in their own suites.
vi.mock("@/lib/preferences", () => ({
  usePreferences: () => ({ locale: "en", setLocale: vi.fn() }),
}))

type Props = React.ComponentProps<typeof AppHeader>

const baseProps: Props = {
  authStatus: "authenticated",
  devUserEnabled: false,
  disabled: false,
  title: "My stories",
  onGoHome: () => {},
  onShowSection: () => {},
  onOpenProfile: () => {},
}

function renderHeader(props: Partial<Props> = {}) {
  authState.current = makeAuth()
  return renderWithLocale(<AppHeader {...baseProps} {...props} />)
}

describe("AppHeader", () => {
  it("renders the screen title as the app's one h1", () => {
    renderHeader()
    expect(screen.getByRole("heading", { level: 1, name: "My stories" })).toBeInTheDocument()
  })

  it("shows no heading mid-sprint, where the bar's centre is deliberately empty", () => {
    // The sprint supplies its own sr-only h1 (see dashboard.tsx); the bar must
    // not add a second one.
    renderHeader({ title: null })
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })

  it("shows the back arrow only when there is somewhere to go back to", () => {
    const onBack = vi.fn()
    const { rerender } = renderHeader({ onBack, backLabel: "Back to home" })
    expect(screen.getByRole("button", { name: "Back to home" })).toBeInTheDocument()

    // The landing is the root of the in-app tree, so it passes no handler.
    rerender(<AppHeader {...baseProps} title="Create a story" />)
    expect(screen.queryByRole("button", { name: "Back to home" })).toBeNull()
  })

  it("fires the back handler", async () => {
    const onBack = vi.fn()
    renderHeader({ onBack, backLabel: "Back to home" })
    await userEvent.click(screen.getByRole("button", { name: "Back to home" }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it("locks every control during a sprint except the theme toggle", () => {
    // Flipping light/dark never touches the session, so it stays live while
    // everything that could leave or restart the sprint is disabled.
    renderHeader({ disabled: true, title: null })

    const theme = screen.getByRole("button", { name: /theme|dark|light/i })
    expect(theme).toBeEnabled()

    const locked = screen
      .getAllByRole("button")
      .filter((b) => b !== theme && !b.hasAttribute("aria-hidden"))
    expect(locked.length).toBeGreaterThan(0)
    for (const button of locked) expect(button).toBeDisabled()
  })

  it("offers the dev-user shortcut only to an anonymous visitor on an enabled backend", () => {
    authState.current = makeAuth({ status: "anonymous", user: null })
    const { rerender } = renderWithLocale(
      <AppHeader {...baseProps} authStatus="anonymous" devUserEnabled />,
    )
    expect(screen.getByRole("button", { name: /dev user/i })).toBeInTheDocument()

    // Backend says the backdoor is off: it must not appear at all.
    rerender(<AppHeader {...baseProps} authStatus="anonymous" devUserEnabled={false} />)
    expect(screen.queryByRole("button", { name: /dev user/i })).toBeNull()
  })
})
