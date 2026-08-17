"use client"

import { Fragment } from "react"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { emptyOverview, zeroWeek } from "@/lib/flowfic/gamification"

import { ChallengesSection } from "./challenges-section"
import { EmptyHint, Panel, SectionHeader, ShowAllButton } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"
import {
  AchievementsStrip,
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
 *   preview — packed into the showcase's fixed 4:3 pane. The highlights and the
 *     achievements strip take their natural height at the ends; the timeline and
 *     the weekly summary share the row between them and split whatever is left,
 *     so the column always fills the pane exactly and never scrolls. On a phone
 *     the pair stacks and the achievements strip drops — the height is better
 *     spent on the timeline, and the strip is a tap away on the detail screen.
 *
 *   full screen — the same parts unconstrained, then all the challenges and the
 *     complete statistics view.
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
            <ProgressHighlights overview={withChart} compact />
            {/* The elastic middle: these two split whatever the ends leave —
                side by side from `sm`, stacked below it. The row count is
                explicit on purpose: left to `auto`, the stacked timeline sized
                to its content, and its plot is `flex-1` inside a `min-h-0`
                column, so it resolved to zero and the card collapsed to its
                heading. Two equal rows give the chart a height to fill. */}
            <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 sm:grid-cols-2 sm:grid-rows-1">
              <TimelineCard overview={withChart} compact />
              <WeeklySummaryCard overview={withChart} compact />
            </div>
            <AchievementsStrip achievements={list} className="hidden sm:flex" />
          </div>
        )}
      </Wrapper>
    )
  }

  // Full screen: the same parts at their natural height — which is the whole of
  // the old statistics view, so there is no separate stats block any more — then
  // all challenges and achievements. Reached only when signed in (Show all / the
  // menu links are gated), but ChallengesSection keeps its own anonymous guard
  // if that ever changes.
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4" aria-label={t.nav.stats}>
        <ProgressHighlights overview={withChart} />
        <div className="grid gap-4 lg:grid-cols-2">
          <TimelineCard overview={withChart} />
          <WeeklySummaryCard overview={withChart} />
        </div>
        <AchievementsStrip achievements={list} />
      </section>
      <ChallengesSection />
    </div>
  )
}
