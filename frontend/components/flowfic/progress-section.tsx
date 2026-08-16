"use client"

import { Clock, Flame, Sparkles, Trophy } from "lucide-react"

import { useAuth } from "@/lib/auth"
import { useLocale, useTranslations } from "@/lib/i18n"
import {
  challengeText,
  challengeVisual,
  dailyIndex,
  emptyOverview,
  formatCount,
  formatHoursMinutes,
  zeroWeek,
} from "@/lib/flowfic/gamification"

import { ChallengesSection } from "./challenges-section"
import {
  CardSubtitle,
  EmptyHint,
  FeaturedChallenge,
  Panel,
  SectionHeader,
  ShowAllButton,
  StatTile,
} from "./dashboard-widgets"
import { useGamification } from "./gamification-context"
import { StatsSection } from "./stats-section"
import { WeeklyChart } from "./weekly-chart"

type Props = {
  /** Begin the new-story flow (from the challenge card's call to action). */
  onNewStory: () => void
  /** Render the combined landing card instead of the full detail screen. */
  preview?: boolean
  /** Open the expanded My-Journey screen (preview only). */
  onShowAll?: () => void
}

/**
 * "My Progress" — the merged progress section (formerly Statistics, Challenges,
 * and Achievements).
 *
 * The landing preview folds three former cards into one, deduplicated: a Level +
 * Streak headline strip, the colourful "Challenge of the day" (kept vivid so it
 * still draws the eye), and a "Weekly summary" block that pairs the weekly chart
 * with this week's totals — the weekly numbers live in one place instead of
 * being split across a summary card and a stats card. Lifetime totals are left
 * to the full screen.
 *
 * The full screen is comprehensive: all challenges, then achievements, then the
 * complete statistics view (reusing the two section components as-is).
 */
export function ProgressSection({ onNewStory, preview = false, onShowAll }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const { status } = useAuth()
  const { overview, challenges } = useGamification()

  const isAnonymous = status === "anonymous"

  if (preview) {
    const ov = overview ?? emptyOverview()
    const chart = ov.chart.length > 0 ? ov.chart : zeroWeek()
    const list = challenges ?? []
    // "Challenge of the day": rotate through the live set so it changes daily.
    const featured = list.length > 0 ? list[dailyIndex(list.length)] : null

    return (
      <Panel>
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
          <div className="flex flex-col gap-5">
            {/* Headline strip: level + current streak. */}
            <div className="grid grid-cols-2 gap-4">
              <Panel className="bg-muted/40 p-4 shadow-none">
                <StatTile icon={Trophy} tone="amber" value={String(ov.level.level)} label={t.dashboard.level} />
              </Panel>
              <Panel className="bg-muted/40 p-4 shadow-none">
                <StatTile icon={Flame} tone="orange" value={String(ov.streak)} label={t.dashboard.daysInARow} />
              </Panel>
            </div>

            {/* Challenge of the day (left) + weekly summary (right). Stacks on
                mobile. */}
            <div className="grid gap-5 lg:grid-cols-2">
              {featured ? (
                <div>
                  <CardSubtitle>{t.dashboard.challengeOfDay}</CardSubtitle>
                  {(() => {
                    const v = challengeVisual(featured.id)
                    const text = challengeText(t, featured.id)
                    return (
                      <FeaturedChallenge
                        icon={v.icon}
                        name={text.name}
                        description={text.description}
                        progress={featured.progress}
                        completed={featured.completed}
                        progressLabel={`${featured.current}/${featured.target}`}
                        completedLabel={t.challenges.completed}
                        ctaLabel={t.dashboard.writeNow}
                        onCta={onNewStory}
                      />
                    )
                  })()}
                </div>
              ) : null}

              <div>
                <CardSubtitle>{t.dashboard.weeklySummary}</CardSubtitle>
                <div className="flex flex-col gap-4">
                  <WeeklyChart data={chart} wordsLabel={t.dashboard.words} caption={t.dashboard.chartCaption} />
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
                </div>
              </div>
            </div>
          </div>
        )}
      </Panel>
    )
  }

  // Full screen: all challenges + achievements, then the complete statistics
  // view. Reached only when signed in (Show all / the menu links are gated), but
  // the reused sections keep their own anonymous guards if that ever changes.
  return (
    <div className="flex flex-col gap-8">
      <ChallengesSection />
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.nav.stats}</h2>
        <StatsSection />
      </section>
    </div>
  )
}
