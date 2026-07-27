"use client"

import { Clock, Flame, Sparkles } from "lucide-react"

import { useLocale, useTranslations } from "@/lib/i18n"
import type { GameSettings } from "@/lib/flowfic/types"
import { DAILY_PROMPTS } from "@/lib/flowfic/prompts"
import {
  dailyPromptIndex,
  emptyOverview,
  formatCount,
  formatHoursMinutes,
} from "@/lib/flowfic/gamification"

import { useGamification } from "./gamification-context"
import { Panel, SectionHeader, StatTile } from "./dashboard-widgets"
import { SettingsPanel } from "./settings-panel"

type Props = {
  settings: GameSettings
  /** Owns the settings object edited by the embedded configurator. */
  onSettingsChange: (settings: GameSettings) => void
}

/**
 * Home screen: a compact top row (the daily prompt beside this week's totals),
 * then the session configurator (presets + detailed settings). Fuller stats and
 * achievements live in their own sections. There is no start button — the
 * header's primary action starts a sprint with whatever is configured below.
 */
export function DashboardHome({ settings, onSettingsChange }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const { overview } = useGamification()

  const ov = overview ?? emptyOverview()
  const prompt = DAILY_PROMPTS[locale][dailyPromptIndex(DAILY_PROMPTS[locale].length)]

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Prompt of the day */}
        <Panel className="flex flex-col">
          <SectionHeader title={t.dashboard.promptOfDay} />
          <p className="text-foreground/80 flex-1 text-xl leading-snug font-medium italic">
            &ldquo;{prompt}&rdquo;
          </p>
        </Panel>

        {/* This week's totals */}
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
      </div>

      {/* Presets + detailed session settings */}
      <SettingsPanel settings={settings} onChange={onSettingsChange} />
    </div>
  )
}
