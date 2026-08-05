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

import { cn } from "@/lib/utils"
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
    // Desktop: the 12:5 canvas as a 3x3 grid — dial (4:4) spanning the two
    // upper rows of column one, the 2x2 mode grid across columns two and three
    // (4:2 a cell), and a row of 4:1 buttons underneath. The gutters are part
    // of the ratio: each cell keeps its proportion including its share of the
    // gap, which is what lets the spacing breathe without redrawing the grid.
    //
    // Mobile: two columns, reordered — dial across the top, then Start beside
    // Custom modes, then the four cards 2x2. "More options" is desktop-only,
    // since the advanced settings panel is too (so `/new` on a phone just
    // renders the normal home screen and needs no redirect).
    <section
      aria-label={t.settings.title}
      className={cn(
        "grid grid-cols-2 gap-4",
        "md:aspect-[12/5] md:grid-cols-3 md:grid-rows-[2fr_2fr_1fr] md:gap-6",
      )}
    >
      {/* Session dial. Capped on phones so the hero doesn't eat the screen. */}
      <div className="order-1 col-span-2 flex min-h-0 items-center justify-center md:order-none md:col-span-1 md:col-start-1 md:row-span-2 md:row-start-1">
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

      {/* Mode grid. Last on a phone, top-right on desktop. */}
      <div className="order-3 col-span-2 flex min-h-0 flex-col gap-2 md:order-none md:col-start-2 md:row-span-2 md:row-start-1">
        <PresetGrid
          settings={settings}
          mode={gridMode}
          onApply={applyPresetSettings}
          onStartChallenge={startChallenge}
        />
      </div>

      <Button
        type="button"
        size="lg"
        onClick={onStart}
        className="order-2 h-full min-h-11 gap-2 text-base font-bold md:order-none md:col-start-1 md:row-start-3"
      >
        <Play className="size-5" aria-hidden />
        {t.settings.start}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onToggleSettings}
        aria-expanded={settingsOpen}
        className="hidden h-full min-h-11 gap-2 md:col-start-2 md:row-start-3 md:inline-flex"
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
        className="order-2 h-full min-h-11 md:order-none md:col-start-3 md:row-start-3"
      >
        {gridMode === "custom" ? t.settings.backToPresetsLabel : t.settings.customModesLabel}
      </Button>
    </section>
  )
}
