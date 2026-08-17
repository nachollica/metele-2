"use client"

// The building blocks of "My Progress", shared by the landing showcase and the
// detail screen. Each takes a `compact` flag rather than being duplicated: the
// landing packs them into a fixed pane that must not scroll, the detail screen
// lets them breathe. Nothing here fetches — the caller passes the already-loaded
// overview/achievements down.

import { BookOpen, Clock, Flame, Sparkles, Trophy } from "lucide-react"

import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "@/lib/i18n"
import {
  achievementText,
  achievementVisual,
  formatCount,
  formatDelta,
  formatHoursMinutes,
  type Achievement,
  type Overview,
} from "@/lib/flowfic/gamification"

import {
  CardSubtitle,
  IconChip,
  ProgressMeter,
  StatTile,
} from "./dashboard-widgets"
import { WeeklyChart } from "./weekly-chart"

/** Shared surface for the boxes inside the section, so they read as one set. */
const BOX = "bg-muted/40 flex flex-col rounded-xl border p-4"

/**
 * Level (with the bar toward the next one) and the current streak, plus lifetime
 * totals where there is room. On the landing the two lifetime tiles drop below
 * `sm` — they are secondary, and the pane's height is better spent on the
 * timeline than on a second row of numbers.
 */
export function ProgressHighlights({
  overview,
  compact = false,
}: {
  overview: Overview
  compact?: boolean
}) {
  const t = useTranslations()
  const locale = useLocale()
  const { level } = overview

  return (
    <div className={cn("grid shrink-0 gap-3", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 lg:grid-cols-4")}>
      {/* Level carries its own progress bar: the number alone says how far you
          have come, the bar says how far to the next one. */}
      <div className={BOX}>
        <StatTile icon={Trophy} tone="amber" value={String(level.level)} label={t.dashboard.level} compact={compact} />
        <ProgressMeter
          className="mt-2"
          tone="amber"
          value={level.xpForLevel > 0 ? level.xpIntoLevel / level.xpForLevel : 0}
          label={`${t.dashboard.level} ${level.level}`}
        />
      </div>
      <div className={BOX}>
        <StatTile icon={Flame} tone="orange" value={String(overview.streak)} label={t.dashboard.daysInARow} compact={compact} />
      </div>
      <div className={cn(BOX, compact && "hidden sm:flex")}>
        <StatTile
          icon={BookOpen}
          tone="green"
          value={formatCount(overview.totalWords, locale)}
          label={t.dashboard.wordsWritten}
          compact={compact}
        />
      </div>
      <div className={cn(BOX, compact && "hidden sm:flex")}>
        <StatTile
          icon={Clock}
          tone="violet"
          value={formatHoursMinutes(overview.totalDurationMs)}
          label={t.dashboard.writingTime}
          compact={compact}
        />
      </div>
    </div>
  )
}

/**
 * The timeline: words per day over the rolling week. Half the width, sharing its
 * row with the weekly summary — the two answer the same question (how did this
 * week go) from different angles, and the week/month range buttons to come will
 * drive both at once.
 */
export function TimelineCard({
  overview,
  compact = false,
}: {
  overview: Overview
  compact?: boolean
}) {
  const t = useTranslations()
  return (
    <section className={cn(BOX, "min-h-0")} aria-label={t.dashboard.timeline}>
      <CardSubtitle>{t.dashboard.timeline}</CardSubtitle>
      <WeeklyChart
        data={overview.chart}
        wordsLabel={t.dashboard.words}
        caption={t.dashboard.chartCaption}
        fill={compact}
      />
    </section>
  )
}

/**
 * This week's totals, sized to match the timeline beside it. Deltas against the
 * previous week are shown where there is room for them.
 */
export function WeeklySummaryCard({
  overview,
  compact = false,
}: {
  overview: Overview
  compact?: boolean
}) {
  const t = useTranslations()
  const locale = useLocale()
  const { weekly } = overview

  return (
    <section className={cn(BOX, "min-h-0")} aria-label={t.dashboard.weeklySummary}>
      <CardSubtitle>{t.dashboard.weeklySummary}</CardSubtitle>
      {/* Centred in whatever height the timeline settles on, so the two boxes
          read as a pair rather than one floating above the other. */}
      <div className="grid min-h-0 flex-1 grid-cols-3 content-center gap-2">
        <StatTile
          icon={Sparkles}
          tone="green"
          value={formatCount(weekly.sessions, locale)}
          label={t.dashboard.sessions}
          compact={compact}
          delta={compact ? null : formatDelta(weekly.deltaSessions)}
          deltaPositive={(weekly.deltaSessions ?? 0) >= 0}
        />
        <StatTile
          icon={Flame}
          tone="amber"
          value={formatCount(weekly.words, locale)}
          label={t.dashboard.words}
          compact={compact}
          delta={compact ? null : formatDelta(weekly.deltaWords)}
          deltaPositive={(weekly.deltaWords ?? 0) >= 0}
        />
        <StatTile
          icon={Clock}
          tone="violet"
          value={formatHoursMinutes(weekly.durationMs)}
          label={t.dashboard.totalTime}
          compact={compact}
          delta={compact ? null : formatDelta(weekly.deltaDurationMs)}
          deltaPositive={(weekly.deltaDurationMs ?? 0) >= 0}
        />
      </div>
    </section>
  )
}

/**
 * Achievements at a glance: every badge in the backend's fixed order, lit when
 * unlocked, plus the locked one closest to falling.
 *
 * Deliberately NOT "recent" — the payload carries no unlock time (see
 * `AchievementRead` in app/gamification.py), so ordering by recency would be a
 * guess. "Next up" is something we can actually compute, and it is the more
 * useful half anyway.
 */
export function AchievementsStrip({
  achievements,
  className,
}: {
  achievements: Achievement[]
  className?: string
}) {
  const t = useTranslations()
  if (achievements.length === 0) return null

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  // Closest to unlocking: the locked one furthest along.
  const next = achievements
    .filter((a) => !a.unlocked)
    .reduce<Achievement | null>((best, a) => (best === null || a.progress > best.progress ? a : best), null)
  const nextText = next ? achievementText(t, next.id) : null
  const nextVisual = next ? achievementVisual(next.id) : null

  return (
    <section className={cn(BOX, "shrink-0", className)} aria-label={t.nav.achievements}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <CardSubtitle className="mb-0">{t.nav.achievements}</CardSubtitle>
        <span className="text-muted-foreground text-xs tabular-nums">
          {t.achievements.unlockedSummary
            .replace("{count}", String(unlockedCount))
            .replace("{total}", String(achievements.length))}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {achievements.map((a) => {
          const v = achievementVisual(a.id)
          const text = achievementText(t, a.id)
          return (
            <IconChip
              key={a.id}
              icon={v.icon}
              tone={v.tone}
              // Locked badges stay in place but recede, so the row doubles as a
              // map of what is left rather than only what is done.
              className={cn("size-9", !a.unlocked && "bg-muted text-muted-foreground/50")}
              iconClassName="size-4"
              label={a.unlocked ? text.name : `${text.name} — ${a.current}/${a.target}`}
            />
          )
        })}
      </div>

      {next && nextText && nextVisual ? (
        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="text-foreground truncate font-semibold">
              {t.achievements.nextUp}: {nextText.name}
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {next.current}/{next.target}
            </span>
          </div>
          <ProgressMeter value={next.progress} tone={nextVisual.tone} label={nextText.name} />
        </div>
      ) : null}
    </section>
  )
}
