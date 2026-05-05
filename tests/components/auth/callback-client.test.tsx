import { screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CallbackClient } from "@/app/[lang]/auth/callback/callback-client"
import { AuthProvider, type AuthUser } from "@/lib/auth"
import { TOKEN_STORAGE_KEY } from "@/lib/auth/client"

import { renderWithLocale } from "@/tests/utils"

const mockUser: AuthUser = {
  id: "google:1",
  provider: "google",
  email: "x@example.com",
  name: "X",
  avatarUrl: null,
}

function encodeUserFragment(u: AuthUser): string {
  const json = JSON.stringify(u)
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function setLocation({
  hash = "",
  search = "",
}: { hash?: string; search?: string }) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...window.location,
      origin: "http://localhost:3000",
      pathname: "/en/auth/callback",
      search,
      hash,
      assign: vi.fn(),
      replace: vi.fn(),
    },
  })
}

describe("CallbackClient", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("persists the session and redirects when the fragment is well-formed", async () => {
    setLocation({
      hash: `#token=jwt&user=${encodeUserFragment(mockUser)}`,
    })
    const replace = window.location.replace as ReturnType<typeof vi.fn>

    renderWithLocale(
      <AuthProvider>
        <CallbackClient />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe("jwt")
      expect(replace).toHaveBeenCalledWith("/en")
    })
  })

  it("shows an error when the backend signaled one in the query string", async () => {
    setLocation({ search: "?error=denied" })

    renderWithLocale(
      <AuthProvider>
        <CallbackClient />
      </AuthProvider>,
    )

    expect(
      await screen.findByRole("link", { name: /back to the game/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("denied")).toBeInTheDocument()
  })

  it("shows an error when the fragment is missing token/user", async () => {
    setLocation({ hash: "#token=jwt" })

    renderWithLocale(
      <AuthProvider>
        <CallbackClient />
      </AuthProvider>,
    )

    expect(
      await screen.findByRole("link", { name: /back to the game/i }),
    ).toBeInTheDocument()
  })

  it("shows an error when the user blob is malformed base64", async () => {
    setLocation({ hash: "#token=jwt&user=!!!not-base64!!!" })

    renderWithLocale(
      <AuthProvider>
        <CallbackClient />
      </AuthProvider>,
    )

    expect(
      await screen.findByRole("link", { name: /back to the game/i }),
    ).toBeInTheDocument()
  })
})
