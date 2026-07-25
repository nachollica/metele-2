"use client"

import { useState } from "react"
import { Clock, Flame, Play, Plus, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useLocale, useTranslations } from "@/lib/i18n"
import type { GameSettings } from "@/lib/flowfic/types"
import type { Story } from "@/lib/flowfic/stories-api"
import { DAILY_PROMPTS } from "@/lib/flowfic/prompts"
import {
  achievementText,
  achievementVisual,
  challengeText,
  challengeVisual,
  dailyPromptIndex,
  emptyOverview,
  formatCount,
  formatDelta,
  formatHoursMinutes,
  zeroWeek,
} from "@/lib/flowfic/gamification"

import { type Section } from "./dashboard-nav"
import { useGamification } from "./gamification-context"
import {
  AchievementItem,
  ChallengeItem,
  Panel,
  QuoteCard,
  SectionHeader,
  StatTile,
} from "./dashboard-widgets"
import { StoryCard } from "./story-card"
import { TimerRing } from "./timer-ring"
import { WeeklyChart } from "./weekly-chart"

const TIME_OPTIONS = [10, 15, 25, 45]

type Props = {
  settings: GameSettings
  /** Start a sprint with an explicit session length (minutes). */
  onStart: (minutes: number) => void
  /** Start a sprint with the currently configured settings. */
  onNewStory: () => void
  onNavigate: (section: Section) => void
  onViewStory: (story: Story) => void
  stories: Story[] | null
  onDeleteStory: (id: number) => Promise<boolean>
}

export function DashboardHome({
  settings,
  onStart,
  onNewStory,
  onNavigate,
  onViewStory,
  stories,
  onDeleteStory,
}: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const { overview, achievements, challenges } = useGamification()

  const ov = overview ?? emptyOverview()
  const chart = ov.chart.length > 0 ? ov.chart : zeroWeek()

  const initialMinutes = Math.round(settings.globalTimerSeconds / 60)
  const [minutes, setMinutes] = useState(
    TIME_OPTIONS.includes(initialMinutes) ? initialMinutes : 25,
  )

  const recent = stories?.slice(0, 3) ?? []
  const topAchievements = (achievements ?? []).slice(0, 3)
  const topChallenges = (challenges ?? []).slice(0, 2)
  const prompt = DAILY_PROMPTS[locale][dailyPromptIndex(DAILY_PROMPTS[locale].length)]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {/* Row 1: quick-start + right column (streak / weekly / quote) */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel className="flex flex-col items-center">
          <div className="mb-2 flex w-full items-center justify-between">
            <h2 className="text-lg font-bold">{t.dashboard.quickStartTitle}</h2>
            <span className="bg-amber-400 text-amber-950 rounded-full px-3 py-1 text-xs font-bold">
              {t.dashboard.quickStartBadge}
            </span>
          </div>
          <TimerRing seconds={minutes * 60} />
          <div className="mt-4">
            <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
              <SelectTrigger className="rounded-full" aria-label={t.dashboard.chooseTime}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} {t.dashboard.minutes}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="lg" className="mt-5 gap-2 px-10 text-base font-bold" onClick={() => onStart(minutes)}>
            <Play className="size-5" aria-hidden />
            {t.dashboard.start}
          </Button>
          <p className="text-muted-foreground mt-3 text-sm">{t.dashboard.quickStartHint}</p>
        </Panel>

        <div className="flex flex-col gap-5">
          {/* Streak */}
          <Panel className="bg-muted/30">
            <div className="text-muted-foreground text-sm">{t.dashboard.streakTitle}</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-5xl font-black tabular-nums">{ov.streak}</div>
                <div className="text-muted-foreground text-sm">{t.dashboard.daysInARow}</div>
              </div>
              <Flame className="size-12 text-orange-500" aria-hidden />
            </div>
          </Panel>

          {/* Weekly summary */}
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

          <QuoteCard quote={t.dashboard.quote} />
        </div>
      </div>

      {/* Row 2: recent stories */}
      <section>
        <SectionHeader
          title={t.dashboard.recentStories}
          action={
            <Button variant="link" className="text-primary h-auto p-0" onClick={() => onNavigate("stories")}>
              {t.dashboard.seeAll}
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recent.map((s) => (
            <StoryCard key={s.id} story={s} onSelect={onViewStory} onDelete={onDeleteStory} />
          ))}
          <button
            type="button"
            onClick={onNewStory}
            className="border-primary/30 text-primary hover:bg-primary/5 flex min-h-[7rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-sm font-semibold transition-colors"
          >
            <Plus className="size-6" aria-hidden />
            {t.dashboard.newStoryCard}
          </button>
        </div>
      </section>

      {/* Row 3: progress chart + achievements */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <SectionHeader
            title={t.dashboard.progressTitle}
            action={
              <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-semibold">
                {t.dashboard.thisWeek}
              </span>
            }
          />
          <WeeklyChart data={chart} wordsLabel={t.dashboard.words} caption={t.dashboard.chartCaption} />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MiniStat
              label={t.dashboard.wordsWritten}
              value={formatCount(ov.weekly.words, locale)}
              delta={formatDelta(ov.weekly.deltaWords)}
              positive={(ov.weekly.deltaWords ?? 0) >= 0}
            />
            <MiniStat
              label={t.dashboard.writingTime}
              value={formatHoursMinutes(ov.weekly.durationMs)}
              delta={formatDelta(ov.weekly.deltaDurationMs)}
              positive={(ov.weekly.deltaDurationMs ?? 0) >= 0}
            />
            <MiniStat
              label={t.dashboard.sessionsCompleted}
              value={formatCount(ov.weekly.sessions, locale)}
              delta={formatDelta(ov.weekly.deltaSessions)}
              positive={(ov.weekly.deltaSessions ?? 0) >= 0}
            />
          </div>
        </Panel>

        <Panel>
          <SectionHeader
            title={t.dashboard.recentAchievements}
            action={
              <Button variant="link" className="text-primary h-auto p-0" onClick={() => onNavigate("achievements")}>
                {t.dashboard.seeAll}
              </Button>
            }
          />
          {topAchievements.length > 0 ? (
            <div className="flex flex-col gap-4">
              {topAchievements.map((a) => {
                const v = achievementVisual(a.id)
                const text = achievementText(t, a.id)
                return (
                  <AchievementItem
                    key={a.id}
                    icon={v.icon}
                    tone={v.tone}
                    name={text.name}
                    description={text.description}
                    unlocked={a.unlocked}
                    current={a.current}
                    target={a.target}
                    progress={a.progress}
                  />
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t.dashboard.signInHint}</p>
          )}
        </Panel>
      </div>

      {/* Row 4: challenges + CTA */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel>
          <SectionHeader
            title={t.dashboard.challengesForYou}
            action={
              <Button variant="link" className="text-primary h-auto p-0" onClick={() => onNavigate("challenges")}>
                {t.dashboard.seeAll}
              </Button>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {topChallenges.map((c) => {
              const v = challengeVisual(c.id)
              const text = challengeText(t, c.id)
              return (
                <ChallengeItem
                  key={c.id}
                  icon={v.icon}
                  tone={v.tone}
                  name={text.name}
                  description={text.description}
                  progress={c.progress}
                  completed={c.completed}
                  progressLabel={`${c.current}/${c.target}`}
                  completedLabel={t.challenges.completed}
                  action={
                    <Button size="sm" className="w-full" onClick={onNewStory}>
                      {t.dashboard.writeNow}
                    </Button>
                  }
                />
              )
            })}
            {/* Prompt of the day */}
            <div className="bg-muted/40 flex flex-col rounded-xl border p-4 sm:col-span-2">
              <div className="mb-2 text-sm font-bold">{t.dashboard.promptOfDay}</div>
              <p className="text-muted-foreground mb-4 flex-1 text-sm italic">&ldquo;{prompt}&rdquo;</p>
              <Button variant="secondary" className="w-full sm:w-auto sm:self-start" onClick={onNewStory}>
                {t.dashboard.writeNow}
              </Button>
            </div>
          </div>
        </Panel>

        <div className="bg-primary text-primary-foreground relative flex flex-col justify-center overflow-hidden rounded-2xl p-6">
          <Sparkles className="absolute top-4 right-4 size-6 opacity-40" aria-hidden />
          <Flame className="absolute right-5 bottom-4 size-16 opacity-25" aria-hidden />
          <h2 className="relative text-2xl font-black leading-tight">{t.dashboard.ctaTitle}</h2>
          <Button
            variant="secondary"
            className="relative mt-4 self-start font-bold"
            onClick={() => onStart(minutes)}
          >
            {t.dashboard.ctaButton}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  delta,
  positive,
}: {
  label: string
  value: string
  delta: string | null
  positive: boolean
}) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-base font-extrabold tabular-nums">{value}</span>
        {delta ? (
          <span
            className={
              positive
                ? "text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground text-xs font-semibold"
            }
          >
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  )
}
