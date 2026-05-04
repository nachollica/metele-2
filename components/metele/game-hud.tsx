"use client"

import { Timer, Clock, Type, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  /** Live character count of the story. */
  characters: number
  /** Cancel the session. */
  onGiveUp: () => void
  /** Master toggle: false hides the required-word panel entirely. */
  requiredWordsEnabled: boolean
  /** Current required word (or null between words). */
  requiredWord: string | null
  /** Seconds left to use the current required word, null if disabled / no word. */
  useWordIn: number | null
  /** Total deadline length used for the progress ring. */
  useWordTotal: number | null
}

export function GameHud({
  idleSecondsLeft,
  idleSecondsTotal,
  globalSecondsLeft,
  globalSecondsTotal,
  characters,
  onGiveUp,
  requiredWordsEnabled,
  requiredWord,
  useWordIn,
  useWordTotal,
}: Props) {
  const t = useTranslations()

  const idleProgress = clamp01(idleSecondsLeft / idleSecondsTotal)
  const globalProgress =
    globalSecondsLeft !== null ? clamp01(globalSecondsLeft / globalSecondsTotal) : 1

  const idleBar = (
    <TimerBar
      icon={<Timer className="size-3.5" aria-hidden />}
      label={t.game.idleEndsIn}
      seconds={idleSecondsLeft}
      progress={idleProgress}
      urgent={idleSecondsLeft <= 3}
    />
  )
  const globalBar =
    globalSecondsLeft !== null ? (
      <TimerBar
        icon={<Clock className="size-3.5" aria-hidden />}
        label={t.game.sessionEndsIn}
        seconds={globalSecondsLeft}
        progress={globalProgress}
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
    <header className="bg-card text-card-foreground flex flex-col gap-3 rounded-lg border p-4 shadow-sm">
      {/* Row 1: title + char count + give up.
          On <lg (mobile/tablet-portrait) only the give-up button stays —
          screen real estate is reserved for timers, required word, text area. */}
      <div className="flex items-center justify-between gap-3">
        <div className="hidden items-baseline gap-3 lg:flex">
          <h1 className="font-serif text-xl font-semibold tracking-tight">{t.app.title}</h1>
          <span className="text-muted-foreground hidden text-sm sm:inline">
            {t.app.tagline}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-muted-foreground hidden items-center gap-1.5 text-sm lg:flex">
            <Type className="size-3.5" aria-hidden />
            <span className="text-foreground font-mono tabular-nums">{characters}</span>
            <span className="hidden sm:inline">{t.game.characters}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onGiveUp}>
            <X className="size-4" aria-hidden />
            {t.game.pause}
          </Button>
        </div>
      </div>

      {body}
    </header>
  )
}

function TimerBar({
  icon,
  label,
  seconds,
  progress,
  urgent,
}: {
  icon: React.ReactNode
  label: string
  seconds: number
  progress: number
  urgent: boolean
}) {
  const t = useTranslations()
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
        aria-valuemax={Math.max(1, Math.round(seconds / Math.max(progress, 0.0001)))}
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

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}
