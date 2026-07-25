"use client"

import { BookOpen, Clock, Flame, Sparkles, Trophy } from "lucide-react"

import { useAuth } from "@/lib/auth"
import { useLocale, useTranslations } from "@/lib/i18n"
import {
  emptyOverview,
  formatCount,
  formatDelta,
  formatHoursMinutes,
  zeroWeek,
} from "@/lib/flowfic/gamification"

import { Panel, SectionHeader, StatTile } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"
import { WeeklyChart } from "./weekly-chart"

export function StatsSection() {
  const t = useTranslations()
  const locale = useLocale()
  const { status } = useAuth()
  const { overview } = useGamification()

  const ov = overview ?? emptyOverview()
  const chart = ov.chart.length > 0 ? ov.chart : zeroWeek()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {status === "anonymous" ? (
        <p className="text-muted-foreground text-sm">{t.dashboard.signInHint}</p>
      ) : null}

      {/* Lifetime totals */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Panel className="p-4">
          <StatTile icon={Trophy} tone="amber" value={String(ov.level.level)} label={t.dashboard.level} />
        </Panel>
        <Panel className="p-4">
          <StatTile icon={Flame} tone="orange" value={String(ov.streak)} label={t.dashboard.daysInARow} />
        </Panel>
        <Panel className="p-4">
          <StatTile
            icon={BookOpen}
            tone="green"
            value={formatCount(ov.totalWords, locale)}
            label={t.dashboard.wordsWritten}
          />
        </Panel>
        <Panel className="p-4">
          <StatTile
            icon={Clock}
            tone="violet"
            value={formatHoursMinutes(ov.totalDurationMs)}
            label={t.dashboard.writingTime}
          />
        </Panel>
      </div>

      {/* Weekly chart */}
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
      </Panel>

      {/* Weekly totals with deltas */}
      <Panel>
        <SectionHeader title={t.dashboard.weeklySummary} />
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            icon={Sparkles}
            tone="green"
            value={formatCount(ov.weekly.sessions, locale)}
            label={t.dashboard.sessionsCompleted}
            delta={formatDelta(ov.weekly.deltaSessions)}
            deltaPositive={(ov.weekly.deltaSessions ?? 0) >= 0}
          />
          <StatTile
            icon={Flame}
            tone="amber"
            value={formatCount(ov.weekly.words, locale)}
            label={t.dashboard.wordsWritten}
            delta={formatDelta(ov.weekly.deltaWords)}
            deltaPositive={(ov.weekly.deltaWords ?? 0) >= 0}
          />
          <StatTile
            icon={Clock}
            tone="violet"
            value={formatHoursMinutes(ov.weekly.durationMs)}
            label={t.dashboard.writingTime}
            delta={formatDelta(ov.weekly.deltaDurationMs)}
            deltaPositive={(ov.weekly.deltaDurationMs ?? 0) >= 0}
          />
        </div>
      </Panel>
    </div>
  )
}
