"use client"

import { Check, Timer, Clock, Pause, Play, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn, clamp01 } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { formatSeconds } from "@/lib/flowfic/format"
import { RequiredWordPanel } from "./required-word-panel"

type Props = {
  /** Seconds remaining before idle timeout fires, or null when it's disabled. */
  idleSecondsLeft: number | null
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
  /** Whether the sprint is currently frozen (flips Pause into Resume). */
  paused: boolean
  /** Whether the sprint is over and the text is in its editable epilogue. */
  ended: boolean
  onPause: () => void
  onResume: () => void
  /** Opens the quit confirmation (which pauses while it is up). */
  onQuit: () => void
  /** Final checkout: save the finished story and return home. */
  onFinish: () => void
}

/**
 * Body card for the game screen: the session controls, the timer bars, and the
 * required-word panel. The controls live here rather than in the app bar so
 * everything that acts on the running sprint is in one place.
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
  paused,
  ended,
  onPause,
  onResume,
  onQuit,
  onFinish,
}: Props) {
  const t = useTranslations()

  const idleBar =
    idleSecondsLeft !== null ? (
      <TimerBar
        icon={<Timer className="size-3.5" aria-hidden />}
        label={t.game.idleEndsIn}
        seconds={idleSecondsLeft}
        total={idleSecondsTotal}
        urgent={idleSecondsLeft <= 3}
      />
    ) : null
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

  // Session controls + timers share the left half; the required-word panel
  // takes the right half when the mechanic is on, otherwise the timers spread
  // across the full width.
  const timers = (
    <div className="flex items-center gap-3">
      <SessionControls
        paused={paused}
        ended={ended}
        onPause={onPause}
        onResume={onResume}
        onQuit={onQuit}
        onFinish={onFinish}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        {idleBar}
        {globalBar}
      </div>
    </div>
  )

  return (
    <section
      aria-label={t.app.title}
      className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm"
    >
      {requiredWordsEnabled ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          {timers}
          <RequiredWordPanel
            word={requiredWord}
            useWordIn={useWordIn}
            useWordTotal={useWordTotal}
          />
        </div>
      ) : (
        timers
      )}
    </section>
  )
}

/**
 * Pause/Resume over Quit, stacked in a square block at the head of the timer
 * row. Icon-led with short labels — "Quit" is the longest thing that fits, and
 * the accessible names carry the full wording. These replace the app bar's old
 * primary action, so the finished-sprint checkout lives here too: once the
 * sprint ends, the two controls collapse into a single Finish button.
 */
function SessionControls({
  paused,
  ended,
  onPause,
  onResume,
  onQuit,
  onFinish,
}: {
  paused: boolean
  ended: boolean
  onPause: () => void
  onResume: () => void
  onQuit: () => void
  onFinish: () => void
}) {
  const t = useTranslations()

  if (ended) {
    return (
      <div className="flex size-20 shrink-0 flex-col justify-center">
        <Button
          type="button"
          size="sm"
          onClick={onFinish}
          aria-label={t.game.finish}
          className="w-full gap-1.5"
        >
          <Check className="size-3.5" aria-hidden />
          {t.game.finishShort}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex size-20 shrink-0 flex-col justify-center gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={paused ? onResume : onPause}
        aria-label={paused ? t.game.resume : t.game.pause}
        className="w-full gap-1.5"
      >
        {paused ? (
          <Play className="size-3.5" aria-hidden />
        ) : (
          <Pause className="size-3.5" aria-hidden />
        )}
        {paused ? t.game.resumeShort : t.game.pause}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onQuit}
        aria-label={t.game.quit}
        className="w-full gap-1.5"
      >
        <X className="size-3.5" aria-hidden />
        {t.game.quitShort}
      </Button>
    </div>
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

