"use client"

import { Clock, Flame, Sparkles } from "lucide-react"

import { useLocale, useTranslations } from "@/lib/i18n"
import { emptyOverview, formatCount, formatHoursMinutes } from "@/lib/flowfic/gamification"
import type { Story } from "@/lib/flowfic/stories-api"

import { ChallengesSection } from "./challenges-section"
import { type Section } from "./dashboard-nav"
import { Panel, SectionHeader, StatTile } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"
import { InspirationImage, QuoteOfDay } from "./inspiration-panel"
import { StatsSection } from "./stats-section"
import { StoriesSection } from "./stories-section"

// Landing order: full-width quote of the day, the inspiration-image widget,
// weekly summary + challenge of the day (half/half), the full-width statistics
// widget, and the full-width recent-stories list. Half-width rows stack on
// mobile. Achievements no longer has its own card — it lives inside the expanded
// Challenges screen.

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
 * sidebar-navigated sections. Order: inspiration image, prompt + this week's
 * totals, then a preview card per subsection, each with a "Show all" link into
 * its expanded screen.
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
  const locale = useLocale()
  const { overview } = useGamification()
  const ov = overview ?? emptyOverview()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      {/* The landing has no visible title by design; this names the screen for
          assistive tech so the page still has a top-level heading. */}
      <h1 className="sr-only">{t.app.title}</h1>

      {/* Quote of the day — full width, top of the dashboard. */}
      <QuoteOfDay />

      {/* Inspiration image — full-width titled widget. */}
      <InspirationImage />

      {/* This week's totals + challenge of the day (half/half). */}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel>
          <SectionHeader title={t.dashboard.weeklySummary} />
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              icon={Sparkles}
              tone="green"
              value={formatCount(ov.weekly.sessions, locale)}
              label={t.dashboard.sessions}
            />
            <StatTile
              icon={Flame}
              tone="amber"
              value={formatCount(ov.weekly.words, locale)}
              label={t.dashboard.words}
            />
            <StatTile
              icon={Clock}
              tone="violet"
              value={formatHoursMinutes(ov.weekly.durationMs)}
              label={t.dashboard.totalTime}
            />
          </div>
        </Panel>
        <ChallengesSection preview onNewStory={onNewStory} onShowAll={() => onShowSection("challenges")} />
      </div>

      {/* Statistics — full width. */}
      <StatsSection preview onShowAll={() => onShowSection("stats")} />

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
