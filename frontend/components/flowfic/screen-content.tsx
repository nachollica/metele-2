"use client"

// Everything the app shows when a sprint is NOT running: the landing, the two
// detail sections, the profile, one story, and not-found. Split out of
// `dashboard.tsx` so the shell is about the shell — the header, the two layout
// branches, navigation and focus — and this is about which screen fills it.
//
// The shell wraps whatever this returns in the shared `ContentColumn`, so a
// case here returns bare content and never its own width or padding.

import { useTranslations } from "@/lib/i18n"
import type { GameSettings } from "@/lib/flowfic/types"
import type { Story } from "@/lib/flowfic/stories-api"

import { Button } from "@/components/ui/button"
import { type Section } from "./dashboard-nav"
import { type Screen } from "./navigation"
import { Spinner } from "./dashboard-widgets"
import { LandingHome } from "./landing"
import { type ShowcaseFace } from "./landing-showcase"
import { type GridMode } from "./preset-grid"
import { ProfilePanel } from "./profile-panel"
import { ProgressSection } from "./progress-section"
import { StoriesSection } from "./stories-section"
import { WritingArea } from "./writing-area"

// ---- Non-split screens (landing / detail subsections / profile / story) --

export function ScreenContent({
  screen,
  story,
  storyMissing,
  settings,
  onChangeSettings,
  onStart,
  settingsOpen,
  onToggleSettings,
  gridMode,
  onToggleGridMode,
  showcaseFace,
  onChangeShowcaseFace,
  stories,
  storiesError,
  storiesTotal,
  storiesHasMore,
  storiesLoadingMore,
  onLoadMoreStories,
  onShowSection,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
  onBackHome,
  onBackToStories,
}: {
  screen: Screen
  /** The record behind a `story` screen, resolved by the parent (which shares
   *  the verdict with the header). `null` while loading or when missing. */
  story: Story | null
  storyMissing: boolean
  settings: GameSettings
  onChangeSettings: (settings: GameSettings) => void
  onStart: () => void
  settingsOpen: boolean
  onToggleSettings: () => void
  gridMode: GridMode
  onToggleGridMode: () => void
  showcaseFace: ShowcaseFace
  onChangeShowcaseFace: (face: ShowcaseFace) => void
  stories: Story[] | null
  storiesError: boolean
  storiesTotal: number | null
  storiesHasMore: boolean
  storiesLoadingMore: boolean
  onLoadMoreStories: () => void
  onShowSection: (section: Section) => void
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateStoryTitle: (id: number, title: string | null) => Promise<boolean>
  onBackHome: () => void
  onBackToStories: () => void
}) {
  const t = useTranslations()

  switch (screen.name) {
    // `landing` and `configuring` are the same screen; the latter just has the
    // advanced-settings face of its panel open (and owns the /new URL).
    case "landing":
    case "configuring":
      return (
        <LandingHome
          settings={settings}
          onChangeSettings={onChangeSettings}
          onStart={onStart}
          settingsOpen={settingsOpen}
          onToggleSettings={onToggleSettings}
          gridMode={gridMode}
          onToggleGridMode={onToggleGridMode}
          showcaseFace={showcaseFace}
          onChangeShowcaseFace={onChangeShowcaseFace}
          onShowSection={onShowSection}
          stories={stories}
          storiesError={storiesError}
          onViewStory={onViewStory}
          onDeleteStory={onDeleteStory}
          onUpdateStoryTitle={onUpdateStoryTitle}
        />
      )
    case "section":
      return (
        <SectionDetail
          section={screen.section}
          stories={stories}
          storiesError={storiesError}
          storiesTotal={storiesTotal}
          storiesHasMore={storiesHasMore}
          storiesLoadingMore={storiesLoadingMore}
          onLoadMoreStories={onLoadMoreStories}
          onViewStory={onViewStory}
          onDeleteStory={onDeleteStory}
          onUpdateStoryTitle={onUpdateStoryTitle}
        />
      )
    case "profile":
      return <ProfilePanel />
    case "story":
      // The title and the back arrow are in the header; here it is just the
      // spinner, the not-found body, or the read-only story.
      if (story === null && !storyMissing) {
        return (
          <div role="status" aria-live="polite" className="flex justify-center py-16">
            <Spinner />
          </div>
        )
      }
      if (story === null) return <NotFoundBody onBack={onBackToStories} label={t.nav.backToStories} />
      return (
        // Sized against the scroll pane, not the viewport: this is the same
        // story the game area shows, and it should read at a comparable height
        // whichever screen it is on.
        <div className="h-[65vh] min-h-96">
          <WritingArea value={story.text} onChange={() => {}} matches={[]} readOnly />
        </div>
      )
    case "notfound":
      return <NotFoundBody onBack={onBackHome} label={t.notFound.backHome} />
  }
}

// Client-rendered not-found screen (no server 404 — the shell is served for
// every app path). Reached for an unknown URL or a story id that doesn't
// resolve; its title and back arrow are in the header, and this button shares
// the arrow's destination, so both are labelled after where they lead.
function NotFoundBody({ onBack, label }: { onBack: () => void; label: string }) {
  const t = useTranslations()
  return (
    <div className="flex flex-col items-start gap-4 py-8">
      <p className="text-muted-foreground">{t.notFound.body}</p>
      <Button type="button" variant="outline" onClick={onBack}>
        {label}
      </Button>
    </div>
  )
}

function SectionDetail({
  section,
  stories,
  storiesError,
  storiesTotal,
  storiesHasMore,
  storiesLoadingMore,
  onLoadMoreStories,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
}: {
  section: Section
  stories: Story[] | null
  storiesError: boolean
  storiesTotal: number | null
  storiesHasMore: boolean
  storiesLoadingMore: boolean
  onLoadMoreStories: () => void
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateStoryTitle: (id: number, title: string | null) => Promise<boolean>
}) {
  switch (section) {
    case "stories":
      return (
        <StoriesSection
          stories={stories}
          error={storiesError}
          total={storiesTotal}
          hasMore={storiesHasMore}
          loadingMore={storiesLoadingMore}
          onLoadMore={onLoadMoreStories}
          onViewStory={onViewStory}
          onDeleteStory={onDeleteStory}
          onUpdateTitle={onUpdateStoryTitle}
        />
      )
    case "progress":
      return <ProgressSection />
  }
}
