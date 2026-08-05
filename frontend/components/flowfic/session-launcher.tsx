"use client"

import { ChevronDown, ChevronUp, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useTranslations } from "@/lib/i18n"
import {
  PRESETS,
  SESSION_MINUTES,
  sessionMinutes,
  type GameSettings,
  type PresetSettings,
} from "@/lib/flowfic/types"

import { PresetGrid, type GridMode } from "./preset-grid"
import { TimerRing } from "./timer-ring"

type Props = {
  settings: GameSettings
  onChange: (settings: GameSettings) => void
  /** Begin the sprint with the current settings. */
  onStart: () => void
  /** Whether the panel below the launcher shows the settings face. */
  settingsOpen: boolean
  onToggleSettings: () => void
  /** Which face the mode grid shows, and how to flip it. */
  gridMode: GridMode
  onToggleGridMode: () => void
}

/**
 * The home screen's hero: everything needed to launch a sprint.
 *
 * Desktop lays it out on a 12:5 canvas — a 3-column, 3-row grid where the
 * session dial occupies a square (4:4) cell spanning the first two rows of
 * column one, the 2x2 mode grid fills columns two and three (each cell 4:2),
 * and the bottom row is three 4:1 buttons: Start, More options, Custom modes.
 * Below `md` the aspect lock is dropped and everything stacks in one column,
 * since a 12:5 box at phone width would leave the dial unreadably small.
 */
export function SessionLauncher({
  settings,
  onChange,
  onStart,
  settingsOpen,
  onToggleSettings,
  gridMode,
  onToggleGridMode,
}: Props) {
  const t = useTranslations()
  const minutes = sessionMinutes(settings)

  function applyPresetSettings(preset: PresetSettings) {
    // Merge: only overwrite preset-covered keys, preserving personal settings.
    onChange({ ...settings, ...preset })
  }

  // The challenge of the day is a direct action: apply its settings (the
  // classic profile until the real challenge rules exist) and play. It keeps
  // the dial's session length so the card never silently changes how long the
  // player just chose to write for.
  function startChallenge() {
    const classic = PRESETS.find((p) => p.id === "classic")
    const next: GameSettings = {
      ...settings,
      ...(classic ? classic.settings : {}),
      globalTimerSeconds: minutes * 60,
    }
    onChange(next)
    onStart()
  }

  return (
    <section
      aria-label={t.settings.title}
      className="grid grid-cols-1 gap-3 md:aspect-[12/5] md:grid-cols-3 md:grid-rows-[2fr_2fr_1fr]"
    >
      {/* Session dial — square cell spanning the two upper rows. Capped on
          phones so the hero doesn't eat the whole first screen. */}
      <div className="flex min-h-0 items-center justify-center md:row-span-2">
        <TimerRing seconds={minutes * 60} className="h-full max-h-full w-56 md:w-auto">
          <Select
            value={String(minutes)}
            onValueChange={(v) =>
              onChange({ ...settings, globalTimerSeconds: Number(v) * 60 })
            }
          >
            <SelectTrigger
              size="sm"
              className="rounded-full"
              aria-label={t.settings.sessionLengthLabel}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_MINUTES.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} {t.dashboard.minutes}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TimerRing>
      </div>

      {/* Mode grid — the two right columns of the two upper rows. */}
      <div className="flex min-h-0 flex-col gap-2 md:col-span-2 md:row-span-2">
        <PresetGrid
          settings={settings}
          mode={gridMode}
          onApply={applyPresetSettings}
          onStartChallenge={startChallenge}
        />
      </div>

      {/* Bottom row: the primary Start plus the two panel toggles. */}
      <Button type="button" size="lg" onClick={onStart} className="h-full min-h-11 gap-2 text-base font-bold">
        <Play className="size-5" aria-hidden />
        {t.settings.start}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onToggleSettings}
        aria-expanded={settingsOpen}
        className="h-full min-h-11 gap-2"
      >
        {settingsOpen ? (
          <ChevronUp className="size-4" aria-hidden />
        ) : (
          <ChevronDown className="size-4" aria-hidden />
        )}
        {t.settings.moreOptions}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onToggleGridMode}
        aria-pressed={gridMode === "custom"}
        className="h-full min-h-11"
      >
        {gridMode === "custom" ? t.settings.backToPresetsLabel : t.settings.customModesLabel}
      </Button>
    </section>
  )
}
