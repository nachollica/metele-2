"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Timer, Clock, Pause, Play, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn, clamp01 } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { formatSeconds } from "@/lib/flowfic/format"
import { RequiredWordPanel } from "./required-word-panel"
import { panelVariants, ProgressMeter } from "./dashboard-widgets"

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
        dimmed={paused}
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
        dimmed={paused}
      />
    ) : null

  // Session controls + timers share the left half; the required-word panel
  // takes the right half when the mechanic is on, otherwise the timers spread
  // across the full width.
  //
  // Pause carries no visible banner of its own: a line of copy here would grow
  // the card and shove everything below it. Sighted players read the state off
  // the controls (Pause has become Play) plus the greyed timers and editor;
  // everyone else gets it from `PauseAnnouncer` below, which speaks it outright
  // rather than leaving it on the toggle's accessible name — that only reaches
  // someone whose focus is already on the toggle, and the quit dialog pauses
  // the sprint without it ever being focused.
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
      className={panelVariants({ padding: "sm" })}
    >
      <PauseAnnouncer paused={paused} />
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
 * Speaks the frozen/running state of the sprint.
 *
 * Silent on mount: a sprint always starts running, so the only thing worth
 * announcing is the change.
 */
function PauseAnnouncer({ paused }: { paused: boolean }) {
  const t = useTranslations()
  const [message, setMessage] = useState("")
  const previous = useRef<boolean | null>(null)

  useEffect(() => {
    const isFirst = previous.current === null
    const changed = previous.current !== paused
    previous.current = paused
    if (isFirst || !changed) return
    setMessage(paused ? t.game.pausedStatus : t.game.resumedStatus)
  }, [paused, t])

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}

/**
 * The session controls, at the head of the timer row: two icon-only squares
 * side by side (Pause/Resume and Quit), their meaning carried by the icons plus
 * their accessible names. These replace the app bar's old primary action, so
 * the finished-sprint checkout lives here too — once the sprint ends the pair
 * collapses into one "Save story" button occupying the same footprint.
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

  // Two size-11 squares plus their gap; the ended button spans the same width
  // so the timers beside it never reflow between states.
  const FOOTPRINT = "w-[5.75rem]"

  if (ended) {
    return (
      <div className={cn("flex shrink-0", FOOTPRINT)}>
        <Button type="button" size="sm" onClick={onFinish} className="w-full gap-1.5">
          <Check className="size-3.5" aria-hidden />
          {t.game.finish}
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("flex shrink-0 gap-1.5", FOOTPRINT)}>
      <Button
        type="button"
        variant="secondary"
        onClick={paused ? onResume : onPause}
        aria-label={paused ? t.game.resume : t.game.pause}
        className="size-11"
      >
        {paused ? (
          <Play className="size-5" aria-hidden />
        ) : (
          <Pause className="size-5" aria-hidden />
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onQuit}
        aria-label={t.game.quit}
        className="size-11"
      >
        <X className="size-5" aria-hidden />
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
  dimmed = false,
}: {
  icon: React.ReactNode
  label: string
  seconds: number
  total: number
  urgent: boolean
  /** Frozen (paused): grey the bar out, since its value is no longer moving. */
  dimmed?: boolean
}) {
  const t = useTranslations()
  const progress = clamp01(seconds / total)
  return (
    <div className={cn("flex flex-col gap-1 transition-opacity", dimmed && "opacity-40")}>
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
      {/* `valueText` because a countdown measured against its own start reads
          as a bare percentage ("42 percent") — useless for a clock. It is the
          same string the sighted player sees in the row above. */}
      <ProgressMeter
        value={progress}
        tone={urgent ? "destructive" : "primary"}
        label={label}
        valueText={formatSeconds(seconds, t.units)}
        speed="live"
      />
    </div>
  )
}

