"use client"

import { useMemo, useState } from "react"
import { Bell, Play } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
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
    if (preset) setSettings(preset.settings)
  }

  function handleStart() {
    onStart(settings)
  }

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

          {/* Detailed settings ----------------------------------------- */}
          <FieldGroup className="gap-4">
            {/* Idle / main timer (always enabled) */}
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="main-timer">{t.settings.mainTimerLabel}</FieldLabel>
                <FieldDescription>{t.settings.mainTimerHelp}</FieldDescription>
              </FieldContent>
              <SecondsInput
                id="main-timer"
                value={settings.mainTimerSeconds}
                min={1}
                max={60}
                onChange={(v) => update("mainTimerSeconds", v)}
              />
            </Field>

            <Separator />

            {/* Global / session timer — toggle inline with input */}
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="global-timer">{t.settings.globalTimerLabel}</FieldLabel>
                <FieldDescription>{t.settings.globalTimerHelp}</FieldDescription>
              </FieldContent>
              <div className="flex items-center gap-3">
                <Switch
                  id="global-timer-toggle"
                  checked={settings.globalTimerEnabled}
                  onCheckedChange={(v) => update("globalTimerEnabled", v)}
                  aria-label={t.settings.globalTimerEnable}
                />
                <SecondsInput
                  id="global-timer"
                  value={settings.globalTimerSeconds}
                  min={30}
                  max={3600}
                  disabled={!settings.globalTimerEnabled}
                  onChange={(v) => update("globalTimerSeconds", v)}
                />
              </div>
            </Field>

            <Separator />

            {/* Required word interval (always on) */}
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="word-interval">
                  {t.settings.requiredWordIntervalLabel}
                </FieldLabel>
                <FieldDescription>{t.settings.requiredWordIntervalHelp}</FieldDescription>
              </FieldContent>
              <SecondsInput
                id="word-interval"
                value={settings.requiredWordIntervalSeconds}
                min={5}
                max={300}
                onChange={(v) => update("requiredWordIntervalSeconds", v)}
              />
            </Field>

            <Separator />

            {/* Required word use deadline — toggle inline with input */}
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="use-timer">
                  {t.settings.requiredWordUseTimerLabel}
                </FieldLabel>
                <FieldDescription>{t.settings.requiredWordUseTimerHelp}</FieldDescription>
              </FieldContent>
              <div className="flex items-center gap-3">
                <Switch
                  id="use-toggle"
                  checked={settings.requiredWordUseTimerEnabled}
                  onCheckedChange={(v) => update("requiredWordUseTimerEnabled", v)}
                  aria-label={t.settings.requiredWordUseTimerEnable}
                />
                <SecondsInput
                  id="use-timer"
                  value={settings.requiredWordUseTimerSeconds}
                  min={5}
                  max={300}
                  disabled={!settings.requiredWordUseTimerEnabled}
                  onChange={(v) => update("requiredWordUseTimerSeconds", v)}
                />
              </div>
            </Field>

            <Separator />

            {/* Bell toggle */}
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="bell-toggle" className="flex items-center gap-2">
                  <Bell className="size-4" aria-hidden />
                  {t.settings.bellLabel}
                </FieldLabel>
              </FieldContent>
              <Switch
                id="bell-toggle"
                checked={settings.bellEnabled}
                onCheckedChange={(v) => update("bellEnabled", v)}
                aria-label={t.settings.bellLabel}
              />
            </Field>
          </FieldGroup>
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

function SecondsInput({
  id,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
}: {
  id: string
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  onChange: (v: number) => void
}) {
  const t = useTranslations()
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 transition-opacity",
        disabled && "opacity-50",
      )}
    >
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (Number.isFinite(next)) {
            onChange(Math.max(min, Math.min(max, next)))
          }
        }}
        className="w-20 font-mono"
      />
      <span className="text-muted-foreground text-sm">{t.settings.secondsSuffix}</span>
    </div>
  )
}
