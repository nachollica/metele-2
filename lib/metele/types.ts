// Shared types for the METELE game.

export type GameSettings = {
  /** Seconds without keystrokes before the session ends. */
  mainTimerSeconds: number
  /** Whether the global session timer is enabled. */
  globalTimerEnabled: boolean
  /** Total session duration in seconds (when enabled). */
  globalTimerSeconds: number
  /** Master toggle for the required-words mechanic. When false, no required
   *  words appear and the per-word deadline is moot. */
  requiredWordIntervalEnabled: boolean
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
  /** Whether to draw required words from a custom pool generated from
   *  user-supplied categories (via the backend `/words/related` endpoint).
   *  When false, the game uses the hardcoded per-locale pool. */
  categoryWordsEnabled: boolean
  /** Raw, comma-separated category/seed words the user typed
   *  (e.g. "kitchen, food, restaurants"). Parsed at game start. */
  categoryWordsInput: string
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
  requiredWordIntervalEnabled: true,
  requiredWordIntervalSeconds: 30,
  requiredWordUseTimerEnabled: true,
  requiredWordUseTimerSeconds: 25,
  bellEnabled: true,
  categoryWordsEnabled: false,
  categoryWordsInput: "",
}

// ---------------------------------------------------------------------------
// Presets
// Curated session profiles the user can apply with one click. Each preset
// specifies only the "preset-covered" keys (PRESET_KEYS below). Applying a
// preset merges these into the current settings, leaving everything else
// ("personal" settings such as bellEnabled) untouched.
//
// To add a new personal setting (not controlled by presets):
//   1. Add its key to GameSettings and DEFAULT_SETTINGS.
//   2. Do NOT add it to PRESET_KEYS — that's all it takes.
// ---------------------------------------------------------------------------

// Keys that presets read and write. Everything in GameSettings that is NOT
// listed here is a personal setting: ignored during preset matching and
// untouched when a preset is applied.
export const PRESET_KEYS = [
  "mainTimerSeconds",
  "globalTimerEnabled",
  "globalTimerSeconds",
  "requiredWordIntervalEnabled",
  "requiredWordIntervalSeconds",
  "requiredWordUseTimerEnabled",
  "requiredWordUseTimerSeconds",
] as const

export type PresetKey = (typeof PRESET_KEYS)[number]
export type PresetSettings = Pick<GameSettings, PresetKey>

export type PresetId = "classic" | "speed" | "relaxed" | "creative" | "marathon" | "chaos"

export type Preset = {
  id: PresetId
  /** Translation key suffix (matches `t.presets[id].name` etc.). */
  settings: PresetSettings
}

export const PRESETS: Preset[] = [
  {
    id: "classic",
    settings: {
      mainTimerSeconds: DEFAULT_SETTINGS.mainTimerSeconds,
      globalTimerEnabled: DEFAULT_SETTINGS.globalTimerEnabled,
      globalTimerSeconds: DEFAULT_SETTINGS.globalTimerSeconds,
      requiredWordIntervalEnabled: DEFAULT_SETTINGS.requiredWordIntervalEnabled,
      requiredWordIntervalSeconds: DEFAULT_SETTINGS.requiredWordIntervalSeconds,
      requiredWordUseTimerEnabled: DEFAULT_SETTINGS.requiredWordUseTimerEnabled,
      requiredWordUseTimerSeconds: DEFAULT_SETTINGS.requiredWordUseTimerSeconds,
    },
  },
  {
    id: "speed",
    settings: {
      mainTimerSeconds: 3,
      globalTimerEnabled: true,
      globalTimerSeconds: 120,
      requiredWordIntervalEnabled: true,
      requiredWordIntervalSeconds: 12,
      requiredWordUseTimerEnabled: true,
      requiredWordUseTimerSeconds: 10,
    },
  },
  {
    id: "relaxed",
    settings: {
      mainTimerSeconds: 15,
      globalTimerEnabled: false,
      globalTimerSeconds: 600,
      requiredWordIntervalEnabled: true,
      requiredWordIntervalSeconds: 60,
      requiredWordUseTimerEnabled: false,
      requiredWordUseTimerSeconds: 60,
    },
  },
  {
    id: "creative",
    settings: {
      mainTimerSeconds: 6,
      globalTimerEnabled: true,
      globalTimerSeconds: 240,
      requiredWordIntervalEnabled: true,
      requiredWordIntervalSeconds: 15,
      requiredWordUseTimerEnabled: true,
      requiredWordUseTimerSeconds: 14,
    },
  },
  {
    id: "marathon",
    settings: {
      mainTimerSeconds: 10,
      globalTimerEnabled: true,
      globalTimerSeconds: 1500,
      requiredWordIntervalEnabled: true,
      requiredWordIntervalSeconds: 45,
      requiredWordUseTimerEnabled: true,
      requiredWordUseTimerSeconds: 40,
    },
  },
  {
    id: "chaos",
    settings: {
      mainTimerSeconds: 2,
      globalTimerEnabled: true,
      globalTimerSeconds: 180,
      requiredWordIntervalEnabled: true,
      requiredWordIntervalSeconds: 8,
      requiredWordUseTimerEnabled: true,
      requiredWordUseTimerSeconds: 7,
    },
  },
]

/** Find which preset (if any) matches the preset-covered keys of a settings object. */
export function findMatchingPreset(s: GameSettings): PresetId | null {
  for (const p of PRESETS) {
    if (PRESET_KEYS.every((k) => p.settings[k] === s[k])) return p.id
  }
  return null
}
