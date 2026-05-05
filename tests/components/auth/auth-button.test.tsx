import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthButton } from "@/components/auth/auth-button"
import { AuthProvider, type AuthUser } from "@/lib/auth"
import { TOKEN_STORAGE_KEY } from "@/lib/auth/client"

import { renderWithLocale } from "@/tests/utils"

const mockUser: AuthUser = {
  id: "google:1",
  provider: "google",
  email: "x@example.com",
  name: "Jane Doe",
  avatarUrl: null,
}

function renderInAuth(locale: "en" | "es" = "en") {
  return renderWithLocale(
    <AuthProvider>
      <AuthButton />
    </AuthProvider>,
    { locale },
  )
}

describe("AuthButton", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders a 'Log in' button when anonymous", async () => {
    renderInAuth()
    expect(
      await screen.findByRole("button", { name: /log in/i }),
    ).toBeInTheDocument()
  })

  it("opens the login modal when clicked while anonymous", async () => {
    renderInAuth()
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /log in/i }))
    expect(
      await screen.findByRole("dialog", { name: /sign in to metele/i }),
    ).toBeInTheDocument()
  })

  it("renders the user's name and account menu when authenticated", async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "tok")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockUser }),
    )
    renderInAuth()

    await waitFor(() =>
      expect(screen.getByText("Jane Doe")).toBeInTheDocument(),
    )
    expect(
      screen.getByRole("button", { name: /account menu/i }),
    ).toBeInTheDocument()
  })

  it("logs the user out when the menu's 'Log out' is clicked", async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "tok")
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockUser }) // /auth/me
      .mockResolvedValueOnce({ ok: true }) // /auth/logout
    vi.stubGlobal("fetch", fetchMock)

    renderInAuth()
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: /account menu/i }),
    )
    await user.click(await screen.findByRole("menuitem", { name: /log out/i }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /log in/i }),
      ).toBeInTheDocument(),
    )
    expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it("uses Spanish translations under the 'es' locale", async () => {
    renderInAuth("es")
    expect(
      await screen.findByRole("button", { name: /iniciar sesi[oó]n/i }),
    ).toBeInTheDocument()
  })
})
