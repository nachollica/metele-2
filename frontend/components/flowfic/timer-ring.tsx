"use client"

// Decorative countdown-style ring for the home quick-start card. It doesn't
// tick — it displays the session length the player is about to start, echoing
// the reference dashboard's hero timer. The live in-game countdowns render in
// the GameHud instead.

const SIZE = 220
const STROKE = 12
const R = (SIZE - STROKE) / 2
const C = SIZE / 2

type Props = {
  /** Seconds to display as mm:ss in the middle of the ring. */
  seconds: number
  /** 0–1 fraction of the ring to fill. Defaults to a full ring. */
  fraction?: number
}

export function TimerRing({ seconds, fraction = 1 }: Props) {
  const circumference = 2 * Math.PI * R
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, fraction)))
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} aria-hidden="true">
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={STROKE}
        />
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-primary font-mono text-5xl font-extrabold tabular-nums">
          {mm}:{ss}
        </span>
      </div>
    </div>
  )
}
