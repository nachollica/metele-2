"use client"

import { Fragment, type ReactNode } from "react"

import { useAuth } from "@/lib/auth"
import { SECTION_TITLE } from "@/lib/text-styles"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { emptyOverview, zeroWeek } from "@/lib/flowfic/gamification"

import { AchievementsSection } from "./achievements-section"
import { ChallengesSection } from "./challenges-section"
import { EmptyHint, Panel, SectionHeader, ShowAllButton } from "./dashboard-widgets"
import { PANE_SHAPE } from "./landing-showcase"
import { useGamification } from "./gamification-context"
import {
  AchievementHighlights,
  ProgressHighlights,
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
 * Both faces are built from the same three parts (see `progress-widgets.tsx`) —
 * literally the same components, so the two screens cannot drift. Only the
 * `compact` flag differs, and it now means one thing: fit a fixed pane.
 *
 *   preview — packed into the showcase's fixed 3:2 pane as two rows: level +
 *     streak beside the achievement highlights on top, the weekly summary full
 *     width below. The rows split the pane evenly, so it always fills exactly
 *     and never scrolls. Each row stacks on a phone.
 *
 *   full screen — the same three parts unconstrained, then the achievements and
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

  // The block itself: two equal rows, identical on both screens. A GRID of two
  // rows rather than a flex column — as a flex column the top row was `flex-1`
  // and the weekly card was not, so the top row ate every spare pixel and the
  // halves came out uneven. `grid-rows-2` makes 50/50 a property of the
  // container instead of something each child has to opt into.
  const block = isAnonymous ? (
    <EmptyHint className="py-6">{t.dashboard.signInHint}</EmptyHint>
  ) : (
    <div className="grid min-h-0 flex-1 grid-rows-2 gap-3">
      {/* The row's column count is explicit, because a stacked `auto` row let
          the chart (a `flex-1` plot in a `min-h-0` column) resolve to zero and
          collapse its card to the heading. 2/5 and 3/5 rather than halves: the
          level pair is two figures and the achievements are three cards, so an
          even split left one cramped and the other airy. */}
      <div className="grid min-h-0 grid-rows-2 gap-3 sm:grid-cols-5 sm:grid-rows-1">
        <ProgressHighlights overview={withChart} className="sm:col-span-2" />
        <AchievementHighlights achievements={list} className="sm:col-span-3" />
      </div>
      <WeeklySummaryCard overview={withChart} compact className="min-h-0" />
    </div>
  )

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
        {block}
      </Wrapper>
    )
  }

  // Full screen: the same block in the same shape, then the two subsections in
  // full. Reached only when signed in (Show all / the menu links are gated), but
  // the subsections keep their own anonymous guards if that ever changes.
  return (
    <div className="flex flex-col gap-8">
      {/* Deliberately NOT a `DetailSubsection` like the two below it, and this
          is the one place on a detail screen that wears a fixed shape.
          `PANE_SHAPE` + `Panel`'s `p-5` + a `SectionHeader` reproduce the
          showcase pane exactly, and both screens put this inside the same
          `ContentColumn` — so the box is the same WIDTH on both, and an
          identical shape therefore makes it the same HEIGHT on both, at every
          viewport, with no transcribed pixel constants. That is what keeps the
          sub-cards the same size here as on the landing.

          The cost, stated plainly: this screen no longer spends its extra room
          on these three cards. It cannot — the landing's pane is what fixes the
          proportions, and matching them means adopting its ceiling. */}
      <Panel className={cn(PANE_SHAPE, "flex flex-col")}>
        <SectionHeader title={t.nav.stats} />
        {block}
      </Panel>

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
 *  the detail pages wears the same heading weight and spacing — and the same
 *  `h2`, which is the rung between the screen's `h1` in the top bar and the `h3`
 *  overlines on the cards inside. */
function DetailSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className={SECTION_TITLE}>{title}</h2>
      {children}
    </section>
  )
}
