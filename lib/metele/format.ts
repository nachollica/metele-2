// Time formatting helpers. Centralizes how timers are displayed across the UI.
// Format rules (per spec):
//   - <60s: "Xs" (no zero padding) — e.g. "7s", "59s".
//   - >=60s: "Xm" or "Xm Xs" — e.g. "1m", "1m 7s", "78m 13s".
// Hours roll into minutes (no "h" unit).

type Units = { seconds: string; minutes: string }

export function formatSeconds(totalSeconds: number, units: Units): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  if (s < 60) return `${s}${units.seconds}`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem === 0 ? `${m}${units.minutes}` : `${m}${units.minutes} ${rem}${units.seconds}`
}

// "MM:SS" stopwatch-style duration. Used for already-finished sessions where
// minute/second framing is the natural read (results modal, sidebar metadata).
export function formatDurationMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}
