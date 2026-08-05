"use client"

// Decorative countdown-style ring for the home screen's session dial. It
// doesn't tick — it displays the session length the player is about to start.
// The live in-game countdowns render in the GameHud instead.
//
// Sized entirely by its parent: the SVG scales with a viewBox and the readout
// uses container-relative units, so the same component fits the launcher's
// square cell at any breakpoint. Children (the length picker) stack under the
// mm:ss readout inside the ring.

import { type ReactNode } from "react"

import { cn } from "@/lib/utils"

// Geometry in viewBox units; the rendered size comes from CSS.
const BOX = 220
const STROKE = 12
const R = (BOX - STROKE) / 2
const C = BOX / 2

type Props = {
  /** Seconds to display as mm:ss in the middle of the ring. */
  seconds: number
  /** 0–1 fraction of the ring to fill. Defaults to a full ring. */
  fraction?: number
  /** Rendered under the readout, inside the ring (the length picker). */
  children?: ReactNode
  className?: string
}

export function TimerRing({ seconds, fraction = 1, children, className }: Props) {
  const circumference = 2 * Math.PI * R
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, fraction)))
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")

  return (
    <div className={cn("relative aspect-square", className)}>
      <svg viewBox={`0 0 ${BOX} ${BOX}`} className="size-full" aria-hidden="true">
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${C} ${C})`}
        />
      </svg>
      {/* Inset so the content never collides with the stroke. */}
      <div className="absolute inset-[14%] flex flex-col items-center justify-center gap-2">
        <span className="text-primary font-mono text-4xl font-extrabold tabular-nums sm:text-5xl">
          {mm}:{ss}
        </span>
        {children}
      </div>
    </div>
  )
}
