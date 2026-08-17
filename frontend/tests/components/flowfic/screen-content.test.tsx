import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ScreenContent } from "@/components/flowfic/screen-content"
import type { AuthContextValue, AuthUser } from "@/lib/auth"
import { DEFAULT_SETTINGS } from "@/lib/flowfic/types"
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

vi.mock("@/lib/preferences", () => ({
  usePreferences: () => ({ locale: "en", setLocale: vi.fn() }),
}))

// The gamification cards fetch through this context in the real tree; the
// router's job is only to pick a screen, so an empty store is enough.
vi.mock("@/components/flowfic/gamification-context", () => ({
  useGamification: () => ({ overview: null, achievements: null, challenges: null }),
  GamificationProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const STORY: Story = {
  id: 7,
  title: "A quiet road",
  text: "The rain had not stopped for three days.",
  lang: "en",
  createdAt: new Date().toISOString(),
  settings: {},
  stats: { words: 8 },
} as unknown as Story

type Props = React.ComponentProps<typeof ScreenContent>

const baseProps: Props = {
  screen: { name: "landing" },
  story: null,
  storyMissing: false,
  settings: DEFAULT_SETTINGS,
  onChangeSettings: () => {},
  onStart: () => {},
  settingsOpen: false,
  onToggleSettings: () => {},
  gridMode: "system",
  onToggleGridMode: () => {},
  showcaseFace: "inspiration",
  onChangeShowcaseFace: () => {},
  stories: [],
  storiesError: false,
  storiesTotal: 0,
  storiesHasMore: false,
  storiesLoadingMore: false,
  onLoadMoreStories: () => {},
  onShowSection: () => {},
  onViewStory: () => {},
  onDeleteStory: async () => true,
  onUpdateStoryTitle: async () => true,
  onBackHome: () => {},
  onBackToStories: () => {},
}

function renderScreen(props: Partial<Props> = {}) {
  authState.current = makeAuth()
  return renderWithLocale(<ScreenContent {...baseProps} {...props} />)
}

describe("ScreenContent", () => {
  it("treats the landing and the open settings panel as one screen", () => {
    renderScreen({ screen: { name: "landing" } })
    expect(screen.queryByRole("heading", { name: "Advanced settings" })).toBeNull()

    // `configuring` is the same screen with the panel open — it owns /new.
    renderScreen({ screen: { name: "configuring" }, settingsOpen: true })
    expect(screen.getByRole("heading", { name: "Advanced settings" })).toBeInTheDocument()
  })

  it("renders the stories section for its section screen", () => {
    renderScreen({ screen: { name: "section", section: "stories" }, storiesTotal: 0 })
    expect(screen.getByText(/no stories yet/i)).toBeInTheDocument()
  })

  it("renders the profile screen", () => {
    renderScreen({ screen: { name: "profile" } })
    expect(screen.getByRole("region", { name: "Your profile" })).toBeInTheDocument()
  })

  it("waits on a spinner while the story behind a /stories/:id is still loading", () => {
    renderScreen({ screen: { name: "story", id: 7 }, story: null, storyMissing: false })
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("shows a resolved story read-only, named after what it holds", () => {
    renderScreen({ screen: { name: "story", id: 7 }, story: STORY })
    const editor = screen.getByRole("textbox", { name: "Story text" })
    expect(editor).toHaveValue(STORY.text)
    expect(editor).toHaveAttribute("readonly")
  })

  it("falls back to not-found when the id does not resolve", () => {
    renderScreen({ screen: { name: "story", id: 999 }, story: null, storyMissing: true })
    expect(screen.getByRole("button", { name: "Back to my stories" })).toBeInTheDocument()
  })

  it("renders not-found for an unknown path", () => {
    renderScreen({ screen: { name: "notfound" } })
    expect(screen.getByRole("button", { name: "Back to home" })).toBeInTheDocument()
  })

  it("supplies no width or padding of its own — the shell owns the column", () => {
    // A case that re-spelled `max-w-5xl` here is exactly how the in-game column
    // and the home screen ended up rendering a story at two different widths.
    const { container } = renderScreen({ screen: { name: "notfound" } })
    expect(container.querySelector("[class*='max-w-']")).toBeNull()
  })
})
