"use client"

import { type ReactNode } from "react"
import { Sparkles, Volume2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { formatSeconds } from "@/lib/flowfic/format"
import {
  type GameSettings,
  type PresetSettings,
  type SoundMode,
  type WordSource,
} from "@/lib/flowfic/types"

import { PresetGrid } from "./preset-grid"

type Props = {
  settings: GameSettings
  onChange: (settings: GameSettings) => void
}

/**
 * Session configurator embedded in the Home screen: preset picker (see
 * `PresetGrid`) on top, then one row per game setting. Purely controlled — the
 * parent owns the settings object and the surrounding scroll.
 */
export function SettingsPanel({ settings, onChange }: Props) {
  const t = useTranslations()

  function update<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    onChange({ ...settings, [key]: value })
  }

  function applyPresetSettings(preset: PresetSettings) {
    // Merge: only overwrite preset-covered keys, preserving personal settings.
    onChange({ ...settings, ...preset })
  }

  const fmtSeconds = (v: number) => formatSeconds(v, t.units)
  const fmtMinutes = (v: number) => `${v}${t.units.minutes}`

  const requiredWordsOn = settings.requiredWordIntervalEnabled

  return (
    <section
      aria-labelledby="settings-title"
      className="bg-card text-card-foreground flex flex-col gap-6 rounded-lg border p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="settings-title" className="text-2xl font-semibold">
          {t.settings.title}
        </h2>
        <p className="text-muted-foreground text-sm">{t.settings.description}</p>
      </div>

      <PresetGrid settings={settings} onApply={applyPresetSettings} />

      <Separator />

      {/* Detailed settings shown on every breakpoint. Help-text under each
          row collapses on `<sm` so the rows stay one-line on small phones;
          otherwise the full description is shown. */}
      <div className="flex flex-col">
        <SettingRow
          id="main-timer"
          label={t.settings.mainTimerLabel}
          description={t.settings.mainTimerHelp}
          control={
            <ValueSlider
              id="main-timer"
              ariaLabel={t.settings.mainTimerLabel}
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
          toggleId="global-timer-toggle"
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
              ariaLabel={t.settings.globalTimerLabel}
              value={Math.round(settings.globalTimerSeconds / 60)}
              min={1}
              max={30}
              disabled={!settings.globalTimerEnabled}
              onChange={(v) => update("globalTimerSeconds", v * 60)}
              format={fmtMinutes}
            />
          }
        />

        {/* Required words — master row: enable toggle plus the word source
            (dropdown) and its seed/hint input, inline on wide screens and
            stacked when narrow. */}
        <SettingRow
          id="word-source"
          label={
            <span className="flex items-center gap-2">
              <Sparkles className="size-4" aria-hidden />
              {t.settings.requiredWordsLabel}
            </span>
          }
          description={t.settings.requiredWordsHelp}
          toggleId="word-interval-toggle"
          toggle={
            <Switch
              id="word-interval-toggle"
              checked={requiredWordsOn}
              onCheckedChange={(v) => update("requiredWordIntervalEnabled", v)}
              aria-label={t.settings.requiredWordIntervalEnable}
            />
          }
          control={
            <div
              className={cn(
                "flex flex-col gap-2 py-2 transition-opacity sm:flex-row",
                !requiredWordsOn && "opacity-50",
              )}
            >
              <Select
                value={settings.wordSource}
                onValueChange={(v) => update("wordSource", v as WordSource)}
                disabled={!requiredWordsOn}
              >
                <SelectTrigger className="shrink-0 sm:w-40" aria-label={t.settings.wordSourceLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">{t.settings.wordSourceFree}</SelectItem>
                  <SelectItem value="universe">{t.settings.wordSourceUniverse}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="word-source"
                type="text"
                value={settings.wordSourceSeeds}
                onChange={(e) => update("wordSourceSeeds", e.target.value)}
                placeholder={
                  settings.wordSource === "universe"
                    ? t.settings.wordSourceUniversePlaceholder
                    : t.settings.wordSourceSeedsPlaceholder
                }
                disabled={!requiredWordsOn}
                aria-label={t.settings.wordSourceSeedsLabel}
                className="flex-1 text-sm"
              />
            </div>
          }
        />

        {/* Required-word sub-settings: hidden entirely when the master toggle
            is off, so the panel collapses instead of showing dimmed rows. */}
        {requiredWordsOn ? (
          <>
            <SettingRow
              id="word-interval"
              label={t.settings.requiredWordIntervalLabel}
              description={t.settings.requiredWordIntervalHelp}
              control={
                <ValueSlider
                  id="word-interval"
                  ariaLabel={t.settings.requiredWordIntervalLabel}
                  value={settings.requiredWordIntervalSeconds}
                  min={5}
                  max={120}
                  onChange={(v) => update("requiredWordIntervalSeconds", v)}
                  format={fmtSeconds}
                />
              }
            />

            <SettingRow
              id="use-timer"
              label={t.settings.requiredWordUseTimerLabel}
              description={t.settings.requiredWordUseTimerHelp}
              toggleId="use-toggle"
              toggle={
                <Switch
                  id="use-toggle"
                  checked={settings.requiredWordUseTimerEnabled}
                  onCheckedChange={(v) => update("requiredWordUseTimerEnabled", v)}
                  aria-label={t.settings.requiredWordUseTimerEnable}
                />
              }
              control={
                <ValueSlider
                  id="use-timer"
                  ariaLabel={t.settings.requiredWordUseTimerLabel}
                  value={settings.requiredWordUseTimerSeconds}
                  min={5}
                  max={120}
                  disabled={!settings.requiredWordUseTimerEnabled}
                  onChange={(v) => update("requiredWordUseTimerSeconds", v)}
                  format={fmtSeconds}
                />
              }
            />

            {/* Word sound: toggle plus the bell/speak mode dropdown, which
                grays out (like a disabled slider) when sound is off. Personal
                setting — never saved into presets. */}
            <SettingRow
              id="sound-mode"
              label={
                <span className="flex items-center gap-2">
                  <Volume2 className="size-4" aria-hidden />
                  {t.settings.soundLabel}
                </span>
              }
              description={t.settings.soundHelp}
              toggleId="sound-toggle"
              toggle={
                <Switch
                  id="sound-toggle"
                  checked={settings.soundEnabled}
                  onCheckedChange={(v) => update("soundEnabled", v)}
                  aria-label={t.settings.soundEnable}
                />
              }
              control={
                <div
                  className={cn(
                    "flex py-2 transition-opacity",
                    !settings.soundEnabled && "opacity-50",
                  )}
                >
                  <Select
                    value={settings.soundMode}
                    onValueChange={(v) => update("soundMode", v as SoundMode)}
                    disabled={!settings.soundEnabled}
                  >
                    <SelectTrigger
                      id="sound-mode"
                      className="w-full sm:w-48"
                      aria-label={t.settings.soundModeLabel}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bell">{t.settings.soundBell}</SelectItem>
                      <SelectItem value="speak">{t.settings.soundSpeak}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
            />
          </>
        ) : null}
      </div>
    </section>
  )
}

// ---- Subcomponents ----------------------------------------------------

function SettingRow({
  id,
  label,
  description,
  toggle,
  toggleId,
  control,
}: {
  id: string
  label: ReactNode
  description?: ReactNode
  toggle?: ReactNode
  toggleId?: string
  control?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Top row for toggle+name on small screens, left half on wide screens */}
      <div className="flex w-full items-center gap-3 sm:w-1/2">
        <label
          htmlFor={toggleId}
          className={cn(
            "flex size-11 shrink-0 cursor-pointer items-center justify-center",
            !toggle && "cursor-default",
          )}
        >
          {toggle}
        </label>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Label htmlFor={id} className="text-foreground text-sm font-semibold">
            {label}
          </Label>
          {description ? (
            <span className="text-muted-foreground hidden text-xs leading-snug sm:inline">
              {description}
            </span>
          ) : null}
        </div>
      </div>
      {/* Bottom row for input/slider on small screens, right half on wide screens */}
      {control ? (
        <div className="w-full pl-14 sm:w-1/2 sm:pl-0">
          {control}
        </div>
      ) : null}
    </div>
  )
}

function ValueSlider({
  id,
  ariaLabel,
  value,
  min,
  max,
  disabled = false,
  onChange,
  format,
}: {
  id: string
  /** Human-readable accessible name for the slider thumb (the role="slider"
   *  element). Matches the row's visible label so screen readers and tests can
   *  identify the control. */
  ariaLabel: string
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
        "flex items-center gap-3 py-2 transition-opacity",
        disabled && "opacity-50",
      )}
    >
      <span className="text-muted-foreground w-16 shrink-0 text-left font-mono text-sm tabular-nums">
        {format(value)}
      </span>
      <Slider
        id={id}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? min)}
        aria-label={ariaLabel}
        className="flex-1 py-2"
      />
    </div>
  )
}
