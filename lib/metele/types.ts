// Shared types for the METELE game.

export type GameSettings = {
  /** Seconds without keystrokes before the session ends. */
  mainTimerSeconds: number
  /** Whether the global session timer is enabled. */
  globalTimerEnabled: boolean
  /** Total session duration in seconds (when enabled). */
  globalTimerSeconds: number
  /** How often a new required word appears (seconds), measured from when the
   *  previous required word was consumed (or from session start for the very
   *  first one). The timer pauses while a required word is unanswered. */
  requiredWordIntervalSeconds: number
  /** Whether the "you must use the required word in time" rule is enforced. */
  requiredWordUseTimerEnabled: boolean
  /** Seconds allotted to actually use the latest required word (when enabled). */
  requiredWordUseTimerSeconds: number
  /** Play a bell sound when a new required word appears. */
  bellEnabled: boolean
}

export type EndReason = "idle" | "global" | "unused-word" | "manual"

export type GameResult = {
  reason: EndReason
  durationMs: number
  characters: number
  words: number
  requiredWordsUsed: number
  text: string
}

export type MatchedRange = {
  /** Start index (inclusive) in the full text. */
  start: number
  /** End index (exclusive) in the full text. */
  end: number
}

export const DEFAULT_SETTINGS: GameSettings = {
  mainTimerSeconds: 7,
  globalTimerEnabled: true,
  globalTimerSeconds: 300,
  requiredWordIntervalSeconds: 30,
  requiredWordUseTimerEnabled: true,
  requiredWordUseTimerSeconds: 25,
  bellEnabled: true,
}

// ---------------------------------------------------------------------------
// Presets
// Curated session profiles the user can apply with one click. Each preset
// fully specifies a `GameSettings` object so applying one is just `setState`.
// Keep this list short (3–5 entries); the order is the rendered order.
// ---------------------------------------------------------------------------

export type PresetId = "classic" | "speed" | "relaxed" | "creative" | "marathon" | "chaos"

export type Preset = {
  id: PresetId
  /** Translation key suffix (matches `t.presets[id].name` etc.). */
  settings: GameSettings
}

export const PRESETS: Preset[] = [
  {
    id: "classic",
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    id: "speed",
    settings: {
      mainTimerSeconds: 3,
      globalTimerEnabled: true,
      globalTimerSeconds: 120,
      requiredWordIntervalSeconds: 12,
      requiredWordUseTimerEnabled: true,
      requiredWordUseTimerSeconds: 10,
      bellEnabled: true,
    },
  },
  {
    id: "relaxed",
    settings: {
      mainTimerSeconds: 15,
      globalTimerEnabled: false,
      globalTimerSeconds: 600,
      requiredWordIntervalSeconds: 60,
      requiredWordUseTimerEnabled: false,
      requiredWordUseTimerSeconds: 60,
      bellEnabled: true,
    },
  },
  {
    id: "creative",
    settings: {
      mainTimerSeconds: 6,
      globalTimerEnabled: true,
      globalTimerSeconds: 240,
      requiredWordIntervalSeconds: 15,
      requiredWordUseTimerEnabled: true,
      requiredWordUseTimerSeconds: 14,
      bellEnabled: true,
    },
  },
  {
    id: "marathon",
    settings: {
      mainTimerSeconds: 10,
      globalTimerEnabled: true,
      globalTimerSeconds: 1500,
      requiredWordIntervalSeconds: 45,
      requiredWordUseTimerEnabled: true,
      requiredWordUseTimerSeconds: 40,
      bellEnabled: true,
    },
  },
  {
    id: "chaos",
    settings: {
      mainTimerSeconds: 2,
      globalTimerEnabled: true,
      globalTimerSeconds: 180,
      requiredWordIntervalSeconds: 8,
      requiredWordUseTimerEnabled: true,
      requiredWordUseTimerSeconds: 7,
      bellEnabled: true,
    },
  },
]

/** Find which preset (if any) exactly matches a settings object. */
export function findMatchingPreset(s: GameSettings): PresetId | null {
  for (const p of PRESETS) {
    const ps = p.settings
    if (
      ps.mainTimerSeconds === s.mainTimerSeconds &&
      ps.globalTimerEnabled === s.globalTimerEnabled &&
      ps.globalTimerSeconds === s.globalTimerSeconds &&
      ps.requiredWordIntervalSeconds === s.requiredWordIntervalSeconds &&
      ps.requiredWordUseTimerEnabled === s.requiredWordUseTimerEnabled &&
      ps.requiredWordUseTimerSeconds === s.requiredWordUseTimerSeconds &&
      ps.bellEnabled === s.bellEnabled
    ) {
      return p.id
    }
  }
  return null
}
