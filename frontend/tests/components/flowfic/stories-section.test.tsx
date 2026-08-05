import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { StoriesSection } from "@/components/flowfic/stories-section"
import type { AuthContextValue, AuthUser } from "@/lib/auth"
import type { Story } from "@/lib/flowfic/stories-api"

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

function renderPreview(stories: Story[] | null) {
  return renderWithLocale(
    <StoriesSection
      preview
      flush
      stories={stories}
      error={false}
      onViewStory={vi.fn()}
      onDeleteStory={vi.fn().mockResolvedValue(true)}
      onUpdateTitle={vi.fn().mockResolvedValue(true)}
    />,
  )
}

describe("StoriesSection preview", () => {
  it("shows at most three stories, newest first", () => {
    authState.current = makeAuth()
    renderPreview([story(1), story(2), story(3), story(4), story(5)])
    // Five available, three rendered — the landing panel is divided into
    // exactly three rows, so a fourth would shrink them all.
    expect(screen.getAllByRole("button", { name: /^Story \d/ })).toHaveLength(3)
  })

  it("keeps three equal rows when the user has fewer stories", () => {
    authState.current = makeAuth()
    const { container } = renderPreview([story(1)])
    expect(screen.getAllByRole("button", { name: /^Story \d/ })).toHaveLength(1)
    // The two unused rows are reserved, so one story lays the panel out the
    // same way three do rather than stretching over the whole box.
    expect(container.querySelectorAll("[aria-hidden]")).not.toHaveLength(0)
  })

  it("renders three skeleton rows while the first load is in flight", () => {
    authState.current = makeAuth()
    const { container } = renderPreview(null)
    expect(container.querySelectorAll("[data-slot=\"skeleton\"]")).toHaveLength(3)
  })

  it("prompts anonymous users to sign in instead of listing rows", () => {
    authState.current = makeAuth({ status: "anonymous", user: null })
    renderPreview([])
    expect(screen.getByText(/sign in to see your saved stories/i)).toBeInTheDocument()
  })
})
