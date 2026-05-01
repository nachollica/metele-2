"use client"

import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"

type Props = {
  /** Current required word, or null when none is active. */
  word: string | null
  /** Seconds left to use the current required word, or null if rule disabled / no word. */
  useWordIn: number | null
  /** Total seconds allowed (used to render the progress ring). */
  useWordTotal: number | null
}

/**
 * Compact required-word display intended to live alongside the HUD timer
 * bars. The word stays large (font-serif text-2xl/3xl) so it remains easy to
 * read at a glance, while the surrounding chrome is kept slim.
 */
export function RequiredWordPanel({ word, useWordIn, useWordTotal }: Props) {
  const t = useTranslations()

  const useProgress =
    useWordIn !== null && useWordTotal !== null && useWordTotal > 0
      ? clamp01(useWordIn / useWordTotal)
      : null
  const urgent = useWordIn !== null && useWordIn <= 5

  return (
    <aside
      aria-label={t.game.requiredWordHeader}
      aria-live="polite"
      className={cn(
        "bg-card text-card-foreground flex min-h-16 items-center gap-3 rounded-md border px-4 py-2.5 shadow-sm transition-colors",
        word ? "border-primary/40" : "border-border",
      )}
    >
      <div className="flex flex-col items-start gap-0.5">
        <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium tracking-widest uppercase">
          <Sparkles className="text-primary size-3" aria-hidden />
          {t.game.requiredWordHeader}
        </span>
        {useWordIn !== null ? (
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums",
              urgent ? "text-destructive font-semibold" : "text-muted-foreground",
            )}
          >
            {t.game.useWordIn} {Math.max(0, useWordIn)}
            {t.units.seconds}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-end gap-3 overflow-hidden">
        {word ? (
          <span
            key={word}
            className="animate-in fade-in zoom-in-95 text-foreground truncate font-serif text-2xl font-semibold tracking-tight duration-300 sm:text-3xl"
          >
            {word}
          </span>
        ) : (
          <span className="text-muted-foreground truncate font-serif text-base italic">
            {t.game.noRequiredWord}
          </span>
        )}

        {useProgress !== null ? (
          <ProgressRing progress={useProgress} urgent={urgent} />
        ) : null}
      </div>
    </aside>
  )
}

function ProgressRing({ progress, urgent }: { progress: number; urgent: boolean }) {
  // 24px ring, stroke 3, radius 9 → circumference 56.55
  const radius = 9
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      className={cn(
        "shrink-0 -rotate-90 transition-colors",
        urgent ? "text-destructive" : "text-primary",
      )}
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={3}
      />
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 200ms linear" }}
      />
    </svg>
  )
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}
