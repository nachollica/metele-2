"use client"

import { useTranslations } from "@/lib/i18n"
import { type Story } from "@/lib/flowfic/stories-api"

import { type Section } from "./dashboard-nav"
import { InspirationImage, QuoteOfDay } from "./inspiration-panel"
import { JourneySection } from "./journey-section"
import { StoriesSection } from "./stories-section"

// Landing order: full-width quote of the day, the inspiration-image widget, the
// combined "My Journey" card (level/streak, challenge of the day, weekly
// summary), and the full-width recent-stories list.

type Props = {
  /** Open an expanded subsection (from a "Show all" link). */
  onShowSection: (section: Section) => void
  /** Begin the new-story flow (challenge call-to-action). */
  onNewStory: () => void
  stories: Story[] | null
  storiesError: boolean
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateStoryTitle: (id: number, title: string | null) => Promise<boolean>
}

/**
 * Landing dashboard: everything the old Home screen showed (minus the session
 * settings, now on the configuring screen) aggregated with the previously
 * sidebar-navigated sections. Order: quote of the day, inspiration image, the
 * combined "My Journey" card, then recent stories — each of the last two with a
 * "Show all" link into its expanded screen.
 */
export function LandingHome({
  onShowSection,
  onNewStory,
  stories,
  storiesError,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
}: Props) {
  const t = useTranslations()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      {/* The landing has no visible title by design; this names the screen for
          assistive tech so the page still has a top-level heading. */}
      <h1 className="sr-only">{t.app.title}</h1>

      {/* Quote of the day — full width, top of the dashboard. */}
      <QuoteOfDay />

      {/* Inspiration image — full-width titled widget. */}
      <InspirationImage />

      {/* Combined progress card — level/streak, challenge of the day, and this
          week's summary — with one "Show all" into the My Journey screen. */}
      <JourneySection
        preview
        onNewStory={onNewStory}
        onShowAll={() => onShowSection("journey")}
      />

      {/* Recent stories — full width. */}
      <StoriesSection
        preview
        onShowAll={() => onShowSection("stories")}
        stories={stories}
        error={storiesError}
        onViewStory={onViewStory}
        onDeleteStory={onDeleteStory}
        onUpdateTitle={onUpdateStoryTitle}
      />
    </div>
  )
}
