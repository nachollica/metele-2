import { screen, waitFor } from "@testing-library/react"
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { StoriesSidebar } from "@/components/flowfic/stories-sidebar"
import type { AuthContextValue } from "@/lib/auth"
import type { Story, StoryListResponse } from "@/lib/flowfic/stories-api"

import { renderWithLocale } from "@/tests/utils"

const { fetchStories, deleteStory } = vi.hoisted(() => ({
  fetchStories: vi.fn(),
  deleteStory: vi.fn(),
}))

vi.mock("@/lib/flowfic/stories-api", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/flowfic/stories-api")
  >("@/lib/flowfic/stories-api")
  return { ...actual, fetchStories, deleteStory }
})

// SidebarPrefs pulls in the preferences provider, which is irrelevant here.
vi.mock("@/components/flowfic/sidebar-prefs", () => ({
  SidebarPrefs: () => null,
}))

const authState: { current: AuthContextValue } = { current: makeAuth() }

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "authenticated",
    user: null,
    loginWithProvider: vi.fn().mockResolvedValue(undefined),
    loginAsDevUser: vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "error" as const }),
    logout: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue("tok"),
    applyLocalUser: vi.fn(),
    ...overrides,
  }
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return { ...actual, useAuth: () => authState.current }
})

const story: Story = {
  id: 1,
  text: "Once upon a resilient token",
  lang: "en",
  createdAt: "2026-01-01T10:00:00.000Z",
  userId: "google-oauth2|abc",
  settings: {},
  stats: {},
}

function page(items: Story[]): StoryListResponse {
  return { items, total: items.length, limit: 50, offset: 0 }
}

describe("StoriesSidebar", () => {
  beforeEach(() => {
    authState.current = makeAuth()
    fetchStories.mockReset().mockResolvedValue(page([story]))
    deleteStory.mockReset().mockResolvedValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the story list on success", async () => {
    renderWithLocale(<StoriesSidebar />)
    expect(await screen.findByText(/Once upon a resilient token/)).toBeVisible()
  })

  it("retries a transient null token and then loads", async () => {
    // First token attempt fails, the retry succeeds — the panel should recover
    // rather than latch the error.
    authState.current = makeAuth({
      getAccessToken: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue("tok"),
    })

    renderWithLocale(<StoriesSidebar />)

    expect(
      await screen.findByText(/Once upon a resilient token/, undefined, {
        timeout: 3000,
      }),
    ).toBeVisible()
    expect(screen.queryByText(/couldn't load stories/i)).not.toBeInTheDocument()
  })

  it("shows the error after exhausting retries, then recovers on focus", async () => {
    authState.current = makeAuth({
      getAccessToken: vi.fn().mockResolvedValue(null),
    })

    renderWithLocale(<StoriesSidebar />)

    expect(
      await screen.findByText(/couldn't load stories/i, undefined, {
        timeout: 4000,
      }),
    ).toBeVisible()

    // A token is available again; a focus event should re-arm the load.
    authState.current.getAccessToken = vi.fn().mockResolvedValue("tok")
    act(() => {
      window.dispatchEvent(new Event("focus"))
    })

    expect(await screen.findByText(/Once upon a resilient token/)).toBeVisible()
  })

  it("does not fetch stories for anonymous users", async () => {
    authState.current = makeAuth({ status: "anonymous", user: null })
    renderWithLocale(<StoriesSidebar />)
    await waitFor(() => expect(fetchStories).not.toHaveBeenCalled())
  })
})
