// Synthesizes a short "bell" tone using the Web Audio API.
// We lazily create a single AudioContext on first use to comply with
// browser autoplay policies (user gesture required to start audio).

let cachedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (cachedContext) return cachedContext
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  cachedContext = new Ctor()
  return cachedContext
}

/**
 * Pre-creates the AudioContext during a user gesture so that later automated
 * calls to playBell() are allowed to produce sound by browsers that require
 * gesture-bound audio contexts.
 */
export function primeAudio(): void {
  const ctx = getContext()
  if (ctx && ctx.state === "suspended") {
    void ctx.resume()
  }
}

export function playBell(): void {
  const ctx = getContext()
  if (!ctx) return

  // Resume if the context was suspended (some browsers do this until a gesture).
  if (ctx.state === "suspended") {
    void ctx.resume()
  }

  const now = ctx.currentTime
  const masterGain = ctx.createGain()
  masterGain.gain.setValueAtTime(0.0001, now)
  masterGain.gain.exponentialRampToValueAtTime(0.35, now + 0.01)
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4)
  masterGain.connect(ctx.destination)

  // Layer a few harmonically-related sine partials for a bell-like timbre.
  const partials: Array<{ freq: number; gain: number }> = [
    { freq: 880, gain: 1.0 },
    { freq: 1320, gain: 0.5 },
    { freq: 1760, gain: 0.25 },
    { freq: 2640, gain: 0.12 },
  ]

  partials.forEach(({ freq, gain }) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq, now)
    g.gain.setValueAtTime(gain, now)
    osc.connect(g)
    g.connect(masterGain)
    osc.start(now)
    osc.stop(now + 1.4)
  })
}
