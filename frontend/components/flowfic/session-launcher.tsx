"use client"

import { ChevronDown, ChevronUp, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { FIELD_LABEL } from "@/lib/text-styles"
import {
  PRESETS,
  SESSION_MINUTES,
  sessionMinutes,
  type GameSettings,
  type PresetSettings,
} from "@/lib/flowfic/types"

import { PresetGrid, type GridMode } from "./preset-grid"
import { formatRingTime, TimerRing } from "./timer-ring"

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
 * Desktop lays it out on a fixed-ratio canvas as a 3-column, 3-row grid: the
 * session dial in a square cell spanning the first two rows of column one, the
 * 2x2 mode grid filling columns two and three, and a row of buttons underneath
 * (Start, More options, Custom modes). Every inner cell takes its height from
 * that canvas, so the whole hero is resized by changing one aspect ratio.
 *
 * Below `md` the ratio is dropped and the pieces reflow (see the grid classes),
 * since a wide canvas at phone width would leave the dial unreadably small.
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
        // An explicit height rather than an aspect ratio: as a flex item in the
        // page column, `aspect-ratio` lost to the content's own height and the
        // hero stayed tall. This is the one number that sizes the whole hero —
        // the rows split it 2:2:1 and every cell takes its height from there,
        // so the dial, the cards and the buttons all shrink together. It grew
        // with the two column headings, which take their room out of the same
        // budget; the dial and the cards keep the size they had without them.
        "md:h-[21rem] md:grid-cols-3 md:grid-rows-[2fr_2fr_1fr] md:gap-5",
      )}
    >
      {/* Session dial. Square, so once its height comes from the row it ends up
          narrower than its column and sits centred there. `min-w-0` matters:
          without it the square's intrinsic width would feed back into the row
          and stretch the whole canvas past its aspect ratio. Capped on phones,
          where there is no canvas to take a height from. */}
      <div className="order-1 col-span-2 flex min-h-0 flex-col items-center gap-2 md:order-none md:col-span-1 md:col-start-1 md:row-span-2 md:row-start-1">
        <h2 className={cn(FIELD_LABEL, "text-muted-foreground shrink-0 text-center")}>
          {t.settings.selectDuration}
        </h2>
        {/* Phone: a fixed width, with the square deriving the height. Desktop:
            the reverse — it takes the height left over by the heading and the
            square derives the width, so it stays inside the cell. */}
        <TimerRing className="w-44 md:min-h-0 md:w-auto md:min-w-0 md:flex-1">
          {/* The readout IS the picker: clicking the numbers opens the list.
              The trigger shows mm:ss while the options read "10 minutes", so
              the dial keeps its clock face and the menu stays legible. */}
          <Select
            value={String(minutes)}
            onValueChange={(v) =>
              onChange({ ...settings, globalTimerSeconds: Number(v) * 60 })
            }
          >
            <SelectTrigger
              aria-label={t.settings.sessionLengthLabel}
              className={cn(
                "text-primary hover:text-primary/80 h-auto! w-auto cursor-pointer gap-1.5 border-0 bg-transparent p-0 font-mono text-3xl font-extrabold tabular-nums shadow-none transition-colors sm:text-4xl",
                "focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent",
                // The trigger's chevron is the only hint that the numbers are a
                // menu, so it stays — scaled up from the default `size-4`,
                // which is lost beside a `text-4xl` readout. Centring the pair
                // leaves the digits marginally left of the ring's axis; that is
                // the cost of the affordance, and it reads as a dropdown.
                "[&>svg]:size-6 [&>svg]:opacity-70",
              )}
            >
              {formatRingTime(minutes * 60)}
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

      {/* Mode grid. Last on a phone, top-right on desktop. The heading names
          the grid whichever face it shows — flipping to the custom modes is
          still picking a game mode. */}
      <div className="order-3 col-span-2 flex min-h-0 flex-col gap-2 md:order-none md:col-start-2 md:row-span-2 md:row-start-1">
        <h2 className={cn(FIELD_LABEL, "text-muted-foreground shrink-0 text-center")}>
          {t.settings.presetsLabel}
        </h2>
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
        className="order-2 h-full min-h-10 gap-2 font-bold md:order-none md:col-start-1 md:row-start-3"
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
        className="hidden h-full min-h-10 gap-2 md:col-start-2 md:row-start-3 md:inline-flex"
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
        className="order-2 h-full min-h-10 md:order-none md:col-start-3 md:row-start-3"
      >
        {gridMode === "custom" ? t.settings.backToPresetsLabel : t.settings.customModesLabel}
      </Button>
    </section>
  )
}
