import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  LandingShowcase,
  type ShowcaseFace,
} from "@/components/flowfic/landing-showcase"
import type { AuthContextValue, AuthUser } from "@/lib/auth"
import * as inspirationModule from "@/lib/flowfic/inspiration"
import type { InspirationImageData, InspirationState } from "@/lib/flowfic/inspiration"
import type { Story } from "@/lib/flowfic/stories-api"

import { renderWithLocale } from "@/tests/utils"

const IMAGE: InspirationImageData = {
  title: "and the ship sails on",
  loc: "https://film-grab.com/2014/12/12/and-the-ship-sails-on/",
  img: "https://film-grab.com/wp-content/uploads/And-The-Ship-01.jpg",
}

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

function mockStore(state: InspirationState, pick = vi.fn()): ReturnType<typeof vi.fn> {
  vi.spyOn(inspirationModule, "useInspiration").mockReturnValue({
    state,
    pick,
    clear: vi.fn(),
  })
  return pick
}

function story(id: number): Story {
  return {
    id,
    title: `Story ${id}`,
    text: `Story ${id} body text.`,
    lang: "en",
    createdAt: new Date().toISOString(),
    userId: baseUser.id,
    settings: {},
    stats: { words: 10 },
  }
}

function Harness({
  initialFace = "inspiration",
  onShowSection = vi.fn(),
  stories = [story(1)],
}: {
  initialFace?: ShowcaseFace
  onShowSection?: (section: "stories" | "progress") => void
  stories?: Story[] | null
}) {
  const [face, setFace] = useState<ShowcaseFace>(initialFace)
  return (
    <LandingShowcase
      face={face}
      onChangeFace={setFace}
      onShowSection={onShowSection}
      stories={stories}
      storiesError={false}
      onViewStory={vi.fn()}
      onDeleteStory={vi.fn().mockResolvedValue(true)}
      onUpdateStoryTitle={vi.fn().mockResolvedValue(true)}
    />
  )
}

describe("LandingShowcase", () => {
  afterEach(() => vi.restoreAllMocks())

  it("opens on the inspiration face, with all three selectors present", () => {
    authState.current = makeAuth()
    mockStore({ status: "unset" })
    renderWithLocale(<Harness />)

    expect(
      screen.getByRole("button", { name: "Click here to get some inspiration" }),
    ).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "My Progress" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(screen.getByRole("button", { name: "Recent stories" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("swaps the pane's contents when another selector is pressed", async () => {
    authState.current = makeAuth()
    mockStore({ status: "unset" })
    renderWithLocale(<Harness />)

    // Only one face is mounted at a time, so the pane never stacks its content.
    expect(screen.queryByRole("button", { name: /^Story 1/ })).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Recent stories" }))
    expect(screen.getByRole("button", { name: /^Story 1/ })).toBeInTheDocument()
    expect(screen.queryByText("Click here to get some inspiration")).toBeNull()
  })

  it("fills an empty store as soon as its face is showing", () => {
    authState.current = makeAuth()
    const pick = mockStore({ status: "unset" })
    renderWithLocale(<Harness initialFace="inspiration" />)
    // No invitation to click: landing on the face IS the request.
    expect(pick).toHaveBeenCalledOnce()
  })

  it("leaves an empty store alone while another face is showing", () => {
    authState.current = makeAuth()
    const pick = mockStore({ status: "unset" })
    renderWithLocale(<Harness initialFace="stories" />)
    expect(pick).not.toHaveBeenCalled()
  })

  it("shows the existing pick when switching back, without re-rolling it", async () => {
    authState.current = makeAuth()
    const pick = mockStore({ status: "image", image: IMAGE })
    renderWithLocale(<Harness initialFace="stories" />)

    // Switching faces must not throw the player's inspiration away.
    await userEvent.click(
      screen.getByRole("button", { name: "Click here to get some inspiration" }),
    )
    expect(pick).not.toHaveBeenCalled()
  })

  it("re-rolls when the already-selected inspiration circle is clicked again", async () => {
    authState.current = makeAuth()
    const pick = mockStore({ status: "image", image: IMAGE })
    renderWithLocale(<Harness initialFace="inspiration" />)

    const circle = screen.getByRole("button", { name: "Show me another inspiration" })
    expect(circle).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("Click for another")).toBeInTheDocument()

    await userEvent.click(circle)
    expect(pick).toHaveBeenCalledOnce()
  })

  it("sends anonymous users to the sign-in hint on the gated faces", async () => {
    authState.current = makeAuth({ status: "anonymous", user: null })
    mockStore({ status: "unset" })
    renderWithLocale(<Harness stories={[]} />)

    await userEvent.click(screen.getByRole("button", { name: "My Progress" }))
    expect(
      screen.getByText("Sign in to save stories and track your progress."),
    ).toBeInTheDocument()
  })
})
