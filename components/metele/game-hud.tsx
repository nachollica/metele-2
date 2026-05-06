"use client"

import { Timer, Clock } from "lucide-react"

import { cn, clamp01 } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { formatSeconds } from "@/lib/metele/format"
import { RequiredWordPanel } from "./required-word-panel"

type Props = {
  /** Seconds remaining before idle timeout fires. */
  idleSecondsLeft: number
  /** Total idle timeout (for proportional bar). */
  idleSecondsTotal: number
  /** Seconds remaining for the global session timer, or null when disabled. */
  globalSecondsLeft: number | null
  /** Total session length (for proportional bar). */
  globalSecondsTotal: number
  /** Master toggle: false hides the required-word panel entirely. */
  requiredWordsEnabled: boolean
  /** Current required word (or null between words). */
  requiredWord: string | null
  /** Seconds left to use the current required word, null if disabled / no word. */
  useWordIn: number | null
  /** Total deadline length used for the progress ring. */
  useWordTotal: number | null
}

/**
 * Body card for the game screen: timer bars and the required-word panel.
 * The screen-level chrome (title, primary action, auth) lives in the shared
 * AppHeader so it stays identical to the settings screen.
 */
export function GameHud({
  idleSecondsLeft,
  idleSecondsTotal,
  globalSecondsLeft,
  globalSecondsTotal,
  requiredWordsEnabled,
  requiredWord,
  useWordIn,
  useWordTotal,
}: Props) {
  const t = useTranslations()

  const idleBar = (
    <TimerBar
      icon={<Timer className="size-3.5" aria-hidden />}
      label={t.game.idleEndsIn}
      seconds={idleSecondsLeft}
      total={idleSecondsTotal}
      urgent={idleSecondsLeft <= 3}
    />
  )
  const globalBar =
    globalSecondsLeft !== null ? (
      <TimerBar
        icon={<Clock className="size-3.5" aria-hidden />}
        label={t.game.sessionEndsIn}
        seconds={globalSecondsLeft}
        total={globalSecondsTotal}
        urgent={globalSecondsLeft <= 10}
      />
    ) : null

  // Layout: when required-words mechanic is on, stack timer bars on the left
  // and put the required-word panel on the right. When it's off, fall back to
  // a simpler layout: idle | global side-by-side, or idle full-width.
  let body: React.ReactNode
  if (requiredWordsEnabled) {
    body = (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <div className="flex flex-col justify-center gap-2">
          {idleBar}
          {globalBar}
        </div>
        <RequiredWordPanel
          word={requiredWord}
          useWordIn={useWordIn}
          useWordTotal={useWordTotal}
        />
      </div>
    )
  } else if (globalBar) {
    body = (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {idleBar}
        {globalBar}
      </div>
    )
  } else {
    body = idleBar
  }

  return (
    <section
      aria-label={t.app.title}
      className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm"
    >
      {body}
    </section>
  )
}

function TimerBar({
  icon,
  label,
  seconds,
  total,
  urgent,
}: {
  icon: React.ReactNode
  label: string
  seconds: number
  total: number
  urgent: boolean
}) {
  const t = useTranslations()
  const progress = clamp01(seconds / total)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span
          className={cn(
            "font-mono tabular-nums",
            urgent ? "text-destructive font-semibold" : "text-foreground",
          )}
        >
          {formatSeconds(seconds, t.units)}
        </span>
      </div>
      <div
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.max(0, Math.round(seconds))}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, Math.round(total))}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            urgent ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}

