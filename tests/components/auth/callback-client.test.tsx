import { screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CallbackClient } from "@/app/[lang]/auth/callback/callback-client"

import { renderWithLocale } from "@/tests/utils"

function setLocation(search: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...window.location,
      origin: "http://localhost:3000",
      pathname: "/en/auth/callback",
      search,
      hash: "",
    },
  })
}

describe("CallbackClient", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the loading spinner by default while Auth0 finishes the exchange", () => {
    setLocation("")
    renderWithLocale(<CallbackClient />)
    expect(screen.getByText(/finishing sign-in/i)).toBeInTheDocument()
  })

  it("surfaces the Auth0 error_description when present in the URL", async () => {
    setLocation("?error=access_denied&error_description=user+canceled")
    renderWithLocale(<CallbackClient />)
    expect(
      await screen.findByRole("link", { name: /back to the game/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/user\+canceled|user canceled/i)).toBeInTheDocument()
  })

  it("falls back to the bare error code when no description is given", async () => {
    setLocation("?error=denied")
    renderWithLocale(<CallbackClient />)
    expect(
      await screen.findByRole("link", { name: /back to the game/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("denied")).toBeInTheDocument()
  })
})
