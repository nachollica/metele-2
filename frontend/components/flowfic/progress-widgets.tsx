"use client"

// The building blocks of "My Progress", shared by the landing showcase and the
// detail screen. Each takes a `compact` flag rather than being duplicated: the
// landing packs them into a fixed pane that must not scroll, the detail screen
// lets them breathe. Nothing here fetches — the caller passes the already-loaded
// overview/achievements down.

import { Clock, Flame, Sparkles, Trophy } from "lucide-react"

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

/** Shared surface for the boxes inside the section, so they read as one set.
 *  Tighter padding on a phone, where four of these stack and the figures inside
 *  them need the room more than the frames do. */
const BOX = "bg-muted/40 flex flex-col rounded-xl border p-3 sm:p-4"

/**
 * Level (with the bar toward the next one) and the current streak.
 *
 * Lifetime word and time totals are deliberately absent: those figures belong to
 * the weekly summary, where they mean "this week" and can move. A lifetime count
 * beside them read as a second, contradictory pair of the same two numbers.
 */
export function ProgressHighlights({
  overview,
  className,
}: {
  overview: Overview
  className?: string
}) {
  const t = useTranslations()
  const { level } = overview

  // The headline pair of the whole section, so they wear the largest tile on
  // the scale — everything else here (weekly figures, achievement badges) is
  // deliberately a step down from them.
  return (
    <section className={cn(BOX, "min-h-0", className)} aria-label={t.dashboard.level}>
      <div className="grid min-h-0 flex-1 grid-cols-2 content-center gap-3">
        {/* Level carries its own bar: the number says how far you have come,
            the bar how far to the next one. */}
        <div className="flex flex-col justify-center">
          <StatTile
            icon={Trophy}
            tone="amber"
            value={String(level.level)}
            label={t.dashboard.level}
            size="lg"
          />
          <ProgressMeter
            className="mt-3 h-2.5"
            tone="amber"
            value={level.xpForLevel > 0 ? level.xpIntoLevel / level.xpForLevel : 0}
            label={`${t.dashboard.level} ${level.level}`}
          />
        </div>
        <StatTile
          icon={Flame}
          tone="orange"
          value={String(overview.streak)}
          label={t.dashboard.daysInARow}
          size="lg"
        />
      </div>
    </section>
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
 * This week's totals, sized to match the timeline beside it. These are the only
 * word and time figures in the section, and they are weekly by definition — see
 * `ProgressHighlights` for why no lifetime pair sits above them. Deltas against
 * the previous week are shown where there is room for them.
 */
export function WeeklySummaryCard({
  overview,
  compact = false,
}: {
  overview: Overview
  /** Drops the week-on-week deltas; the figures themselves keep their size,
   *  since this card shares its row with the timeline and reads as its peer. */
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
          size="md"
          delta={compact ? null : formatDelta(weekly.deltaSessions)}
          deltaPositive={(weekly.deltaSessions ?? 0) >= 0}
        />
        <StatTile
          icon={Flame}
          tone="amber"
          value={formatCount(weekly.words, locale)}
          label={t.dashboard.words}
          size="md"
          delta={compact ? null : formatDelta(weekly.deltaWords)}
          deltaPositive={(weekly.deltaWords ?? 0) >= 0}
        />
        <StatTile
          icon={Clock}
          tone="violet"
          value={formatHoursMinutes(weekly.durationMs)}
          label={t.dashboard.totalTime}
          size="md"
          delta={compact ? null : formatDelta(weekly.deltaDurationMs)}
          deltaPositive={(weekly.deltaDurationMs ?? 0) >= 0}
        />
      </div>
    </section>
  )
}

/** How many achievements the highlight card shows. Three, to balance the two
 *  badges in the level card beside it. */
const HIGHLIGHT_COUNT = 3

/**
 * The three achievements worth showing, most-earned-first.
 *
 * "Recent" is not something the data can express: `AchievementRead` (see
 * app/gamification.py) is recomputed from the user's stories on every request
 * and carries no unlock time, so there is no recency to sort by. The nearest
 * honest reading is *latest earned* — the backend emits a fixed order that runs
 * roughly easiest to hardest, so the last unlocked ids are the ones most
 * recently reached in practice. Those come first, and any shortfall is filled
 * with the locked ones closest to falling, which is the more motivating half
 * anyway. Exported for its test.
 */
export function highlightAchievements(achievements: Achievement[]): Achievement[] {
  const unlocked = achievements.filter((a) => a.unlocked).reverse()
  const closest = achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.progress - a.progress)
  return [...unlocked, ...closest].slice(0, HIGHLIGHT_COUNT)
}

/**
 * Achievement highlights: three badges, each with its name and — while locked —
 * how far along it is.
 *
 * Tinted amber, but only just: this sits beside the level card in the same row
 * and has to read as its sibling, not as another "challenge of the day". The
 * colour comes from the badges themselves plus a wash on the card.
 */
export function AchievementHighlights({
  achievements,
  className,
}: {
  achievements: Achievement[]
  className?: string
}) {
  const t = useTranslations()
  if (achievements.length === 0) return null

  const shown = highlightAchievements(achievements)
  const unlockedCount = achievements.filter((a) => a.unlocked).length

  return (
    <section
      className={cn(
        BOX,
        "min-h-0 border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10",
        className,
      )}
      aria-label={t.nav.achievements}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <CardSubtitle className="mb-0">{t.nav.achievements}</CardSubtitle>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {t.achievements.unlockedSummary
            .replace("{count}", String(unlockedCount))
            .replace("{total}", String(achievements.length))}
        </span>
      </div>

      {/* `grid-rows-1` is load-bearing: without an explicit row the implicit one
          is `auto`, so it sizes to the cards' content and overflows the box it
          was given — on a phone that put the cards straight through the timeline
          below. Pinning one `1fr` row keeps them inside. */}
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-1 gap-2">
        {shown.map((a) => {
          const v = achievementVisual(a.id)
          const text = achievementText(t, a.id)
          return (
            <article
              key={a.id}
              className={cn(
                "bg-card/70 flex min-h-0 min-w-0 flex-col items-center gap-2 overflow-hidden rounded-lg border p-3 text-center",
                !a.unlocked && "opacity-75",
              )}
            >
              {/* Centred in whatever the bar leaves, so a tall card spreads its
                  slack above and below the text instead of pooling it under. */}
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
                <IconChip
                  icon={v.icon}
                  tone={v.tone}
                  // A locked badge recedes rather than disappearing, so the card
                  // shows what is close as well as what is done.
                  className={cn("size-10", !a.unlocked && "bg-muted text-muted-foreground/60")}
                  iconClassName="size-5"
                  label={a.unlocked ? text.name : `${text.name} — ${a.current}/${a.target}`}
                />
                <h3 className="line-clamp-2 text-xs leading-tight font-semibold">{text.name}</h3>
                {/* What it takes to earn it — the same sentence the full
                    achievements grid shows, so a new achievement needs no extra
                    copy here to appear. Dropped on a phone, where three cards
                    share ~100px each and the sentence is what tips them past
                    their row into the timeline below. */}
                <p className="text-muted-foreground line-clamp-3 hidden text-[0.7rem] leading-snug sm:block">
                  {text.description}
                </p>
              </div>
              {/* Pinned to the foot of the card so the three read as one row of
                  bars rather than three free-floating stacks. */}
              <div className="w-full">
                <ProgressMeter value={a.progress} tone={v.tone} label={text.name} />
                <div className="text-muted-foreground mt-1 text-[0.65rem] tabular-nums">
                  {a.unlocked ? t.challenges.completed : `${a.current}/${a.target}`}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
