"use client"

import { Fragment, type ReactNode } from "react"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { emptyOverview, zeroWeek } from "@/lib/flowfic/gamification"

import { AchievementsSection } from "./achievements-section"
import { ChallengesSection } from "./challenges-section"
import { EmptyHint, Panel, SectionHeader, ShowAllButton } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"
import {
  AchievementHighlights,
  ProgressHighlights,
  TimelineCard,
  WeeklySummaryCard,
} from "./progress-widgets"

type Props = {
  /** Render the combined landing card instead of the full detail screen. */
  preview?: boolean
  /** Drop the preview's own card chrome — the showcase pane already supplies it. */
  flush?: boolean
  /** Open the expanded My-Progress screen (preview only). */
  onShowAll?: () => void
}

/**
 * "My Progress" — the merged progress section (formerly Statistics, Challenges,
 * and Achievements).
 *
 * Both faces are built from the same parts (see `progress-widgets.tsx`), each
 * taking a `compact` flag rather than being written twice:
 *
 *   preview — packed into the showcase's fixed 3:2 pane as two rows of two:
 *     level + streak beside the achievement highlights on top, the timeline
 *     beside the weekly summary below. The rows split the pane evenly, so it
 *     always fills exactly and never scrolls. Each row stacks on a phone.
 *
 *   full screen — the same four parts unconstrained, then the achievements and
 *     challenges subsections in full.
 *
 * The "challenge of the day" is deliberately not here: the launcher's mode grid
 * already gives it a card, and repeating it cost the pane a third of its height.
 */
export function ProgressSection({ preview = false, flush = false, onShowAll }: Props) {
  const t = useTranslations()
  const { status } = useAuth()
  const { overview, achievements } = useGamification()

  const isAnonymous = status === "anonymous"
  // Anonymous users and the first authenticated tick have nothing yet; the
  // zeroed overview keeps every number rendering cleanly instead of blank.
  const ov = overview ?? emptyOverview()
  const withChart = ov.chart.length > 0 ? ov : { ...ov, chart: zeroWeek() }
  const list = achievements ?? []

  if (preview) {
    // Flush drops the card chrome (the showcase pane already supplies it) and,
    // with it, the wrapper element — so this column is the direct child of that
    // fixed-shape pane and can fill it.
    const Wrapper = flush ? Fragment : Panel
    return (
      <Wrapper>
        <SectionHeader
          title={t.nav.progress}
          action={
            onShowAll ? (
              <ShowAllButton
                label={t.nav.showAll}
                sectionName={t.nav.progress}
                onClick={onShowAll}
                disabled={isAnonymous}
              />
            ) : null
          }
        />
        {isAnonymous ? (
          <EmptyHint className="py-6">{t.dashboard.signInHint}</EmptyHint>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {/* Two rows of two, splitting the pane evenly. Each row's column
                count is explicit, because a stacked `auto` row let the chart (a
                `flex-1` plot in a `min-h-0` column) resolve to zero and collapse
                its card to the heading. Within the top row, 2/5 and 3/5 rather
                than halves: the level pair is two figures and the achievements
                are three cards, so an even split left one cramped and the other
                airy. */}
            <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 sm:grid-cols-5 sm:grid-rows-1">
              <ProgressHighlights overview={withChart} className="sm:col-span-2" />
              <AchievementHighlights achievements={list} className="sm:col-span-3" />
            </div>
            <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 sm:grid-cols-2 sm:grid-rows-1">
              <TimelineCard overview={withChart} compact />
              <WeeklySummaryCard overview={withChart} compact />
            </div>
          </div>
        )}
      </Wrapper>
    )
  }

  // Full screen: the landing's four parts at the top, unconstrained — the same
  // components, so the two screens can never drift — then the two full
  // subsections underneath. Reached only when signed in (Show all / the menu
  // links are gated), but the subsections keep their own anonymous guards if
  // that ever changes.
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4" aria-label={t.nav.stats}>
        <div className="grid gap-4 lg:grid-cols-5">
          <ProgressHighlights overview={withChart} className="lg:col-span-2" />
          <AchievementHighlights achievements={list} className="lg:col-span-3" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TimelineCard overview={withChart} />
          <WeeklySummaryCard overview={withChart} />
        </div>
      </section>

      <DetailSubsection title={t.nav.achievements}>
        <AchievementsSection />
      </DetailSubsection>

      <DetailSubsection title={t.challenges.dailyGroup}>
        <ChallengesSection />
      </DetailSubsection>
    </div>
  )
}

/** A titled block on a detail screen. One definition so every subsection across
 *  the detail pages wears the same heading weight and spacing. */
function DetailSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}
