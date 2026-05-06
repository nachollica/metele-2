import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LoginModal } from "@/components/auth/login-modal"

import { renderWithLocale } from "@/tests/utils"

const startProviderLogin = vi.fn()

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    startProviderLogin: (...args: Parameters<typeof actual.startProviderLogin>) =>
      startProviderLogin(...args),
  }
})

describe("LoginModal", () => {
  beforeEach(() => {
    startProviderLogin.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders one button per provider plus a mock shortcut by default", () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />)
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /continue with instagram/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /continue with facebook/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /try mock account/i }),
    ).toBeInTheDocument()
  })

  it("hides the mock shortcut when showMock=false", () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} showMock={false} />)
    expect(
      screen.queryByRole("button", { name: /try mock account/i }),
    ).not.toBeInTheDocument()
  })

  it("dispatches the real provider flow when a provider button is clicked", async () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />, { locale: "en" })
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /continue with google/i }))
    expect(startProviderLogin).toHaveBeenCalledWith("google", "en", { mock: false })
  })

  it("dispatches the mock flow when the mock shortcut is clicked", async () => {
    renderWithLocale(<LoginModal open onOpenChange={() => {}} />, { locale: "es" })
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /probar cuenta de prueba/i }))
    expect(startProviderLogin).toHaveBeenCalledWith("google", "es", { mock: true })
  })

  it("calls onOpenChange(false) when the cancel button is clicked", async () => {
    const onOpenChange = vi.fn()
    renderWithLocale(<LoginModal open onOpenChange={onOpenChange} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /maybe later/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
