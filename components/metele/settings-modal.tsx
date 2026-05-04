"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Bell, Play } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { formatSeconds } from "@/lib/metele/format"
import {
  DEFAULT_SETTINGS,
  PRESETS,
  findMatchingPreset,
  type GameSettings,
  type PresetId,
} from "@/lib/metele/types"

type Props = {
  open: boolean
  initial?: GameSettings
  onStart: (settings: GameSettings) => void
}

export function SettingsModal({ open, initial = DEFAULT_SETTINGS, onStart }: Props) {
  const t = useTranslations()
  const [settings, setSettings] = useState<GameSettings>(initial)

  // Auto-detect when the current settings match a preset so we can highlight
  // it. This stays in sync even if the user manually tweaks values to match.
  const activePresetId = useMemo<PresetId | null>(
    () => findMatchingPreset(settings),
    [settings],
  )

  function update<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function applyPreset(id: PresetId) {
    const preset = PRESETS.find((p) => p.id === id)
    // Merge: only overwrite preset-covered keys, preserving personal settings.
    if (preset) setSettings((prev) => ({ ...prev, ...preset.settings }))
  }

  function handleStart() {
    onStart(settings)
  }

  const fmtSeconds = (v: number) => formatSeconds(v, t.units)
  const fmtMinutes = (v: number) => `${v}${t.units.minutes}`

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl"
        // Prevent dismiss without starting the game.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t.settings.title}</DialogTitle>
          <DialogDescription>{t.settings.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* Presets ---------------------------------------------------- */}
          <section className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              {t.settings.presetsLabel}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESETS.map((preset) => {
                const isActive = activePresetId === preset.id
                const meta = t.presets[preset.id]
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                      "hover:bg-accent/30 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                      isActive
                        ? "border-primary bg-primary/5 ring-primary/30 ring-1"
                        : "border-border bg-card",
                    )}
                  >
                    <span className="text-foreground font-serif text-sm font-semibold">
                      {meta.name}
                    </span>
                    <span className="text-muted-foreground text-xs leading-snug">
                      {meta.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <Separator />

          {/* Detailed settings — uniform inline rows, no inter-row dividers. */}
          <div className="flex flex-col">
            <SettingRow
              id="main-timer"
              label={t.settings.mainTimerLabel}
              description={t.settings.mainTimerHelp}
              control={
                <ValueSlider
                  id="main-timer"
                  value={settings.mainTimerSeconds}
                  min={1}
                  max={60}
                  onChange={(v) => update("mainTimerSeconds", v)}
                  format={fmtSeconds}
                />
              }
            />

            <SettingRow
              id="global-timer"
              label={t.settings.globalTimerLabel}
              description={t.settings.globalTimerHelp}
              toggle={
                <Switch
                  id="global-timer-toggle"
                  checked={settings.globalTimerEnabled}
                  onCheckedChange={(v) => update("globalTimerEnabled", v)}
                  aria-label={t.settings.globalTimerEnable}
                />
              }
              control={
                <ValueSlider
                  id="global-timer"
                  value={Math.round(settings.globalTimerSeconds / 60)}
                  min={1}
                  max={60}
                  disabled={!settings.globalTimerEnabled}
                  onChange={(v) => update("globalTimerSeconds", v * 60)}
                  format={fmtMinutes}
                />
              }
            />

            <SettingRow
              id="word-interval"
              label={t.settings.requiredWordIntervalLabel}
              description={t.settings.requiredWordIntervalHelp}
              toggle={
                <Switch
                  id="word-interval-toggle"
                  checked={settings.requiredWordIntervalEnabled}
                  onCheckedChange={(v) => update("requiredWordIntervalEnabled", v)}
                  aria-label={t.settings.requiredWordIntervalEnable}
                />
              }
              control={
                <ValueSlider
                  id="word-interval"
                  value={settings.requiredWordIntervalSeconds}
                  min={5}
                  max={300}
                  disabled={!settings.requiredWordIntervalEnabled}
                  onChange={(v) => update("requiredWordIntervalSeconds", v)}
                  format={fmtSeconds}
                />
              }
            />

            <SettingRow
              id="use-timer"
              label={t.settings.requiredWordUseTimerLabel}
              description={t.settings.requiredWordUseTimerHelp}
              dimmed={!settings.requiredWordIntervalEnabled}
              toggle={
                <Switch
                  id="use-toggle"
                  checked={settings.requiredWordUseTimerEnabled}
                  onCheckedChange={(v) => update("requiredWordUseTimerEnabled", v)}
                  disabled={!settings.requiredWordIntervalEnabled}
                  aria-label={t.settings.requiredWordUseTimerEnable}
                />
              }
              control={
                <ValueSlider
                  id="use-timer"
                  value={settings.requiredWordUseTimerSeconds}
                  min={5}
                  max={300}
                  disabled={
                    !settings.requiredWordIntervalEnabled ||
                    !settings.requiredWordUseTimerEnabled
                  }
                  onChange={(v) => update("requiredWordUseTimerSeconds", v)}
                  format={fmtSeconds}
                />
              }
            />

            <SettingRow
              id="bell-toggle"
              label={
                <span className="flex items-center gap-2">
                  <Bell className="size-4" aria-hidden />
                  {t.settings.bellLabel}
                </span>
              }
              toggle={
                <Switch
                  id="bell-toggle"
                  checked={settings.bellEnabled}
                  onCheckedChange={(v) => update("bellEnabled", v)}
                  aria-label={t.settings.bellLabel}
                />
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleStart} className="w-full sm:w-auto">
            <Play className="size-4" aria-hidden />
            {t.settings.start}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Width reserved on the left of every row for the toggle. Non-toggleable rows
// render an empty spacer of the same width so labels stay vertically aligned.
const TOGGLE_COL = "w-11 shrink-0"
// Sliders share a fixed width so rows look uniform regardless of scale.
const SLIDER_COL = "w-44 shrink-0"

function SettingRow({
  id,
  label,
  description,
  toggle,
  control,
  dimmed = false,
}: {
  id: string
  label: ReactNode
  description?: ReactNode
  toggle?: ReactNode
  control?: ReactNode
  // Visually muted (used when a parent toggle disables this row's settings).
  dimmed?: boolean
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className={cn(TOGGLE_COL, "flex items-center justify-start transition-opacity", dimmed && "opacity-50")}>
        {toggle}
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-0.5 transition-opacity",
          dimmed && "opacity-50",
        )}
      >
        <Label htmlFor={id} className="text-foreground text-sm font-semibold">
          {label}
        </Label>
        {description ? (
          <span className="text-muted-foreground text-xs leading-snug">
            {description}
          </span>
        ) : null}
      </div>
      {control ? <div className={SLIDER_COL}>{control}</div> : null}
    </div>
  )
}

function ValueSlider({
  id,
  value,
  min,
  max,
  disabled = false,
  onChange,
  format,
}: {
  id: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (v: number) => void
  format: (v: number) => string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 transition-opacity",
        disabled && "opacity-50",
      )}
    >
      <Slider
        id={id}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? min)}
        aria-label={id}
        className="flex-1"
      />
      <span className="text-muted-foreground w-16 shrink-0 text-right font-mono text-sm tabular-nums">
        {format(value)}
      </span>
    </div>
  )
}
