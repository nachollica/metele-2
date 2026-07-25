"use client"

import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"

import { useTranslations } from "@/lib/i18n"
import type { GameSettings } from "@/lib/flowfic/types"

import { SettingsPanel } from "./settings-panel"

type Props = {
  settings: GameSettings
  onSettingsChange: (settings: GameSettings) => void
  /** Start a sprint with the configured settings. */
  onStart: () => void
}

/**
 * The "Ajustes" section: the full session configurator (presets + timers +
 * required-words) reused from the original landing screen, with a prominent
 * Start action so a sprint can be launched straight from here.
 */
export function SettingsSection({ settings, onSettingsChange, onStart }: Props) {
  const t = useTranslations()
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <SettingsPanel settings={settings} onChange={onSettingsChange} />
      <div className="flex justify-end">
        <Button size="lg" className="gap-2 font-bold" onClick={onStart}>
          <Pencil className="size-4" aria-hidden />
          {t.settings.start}
        </Button>
      </div>
    </div>
  )
}
