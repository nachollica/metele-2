// Shared types for the Flowfic game.

/** How a new required word is announced when sound is enabled. */
export type SoundMode = "bell" | "speak"

/** Where required words are drawn from. */
export type WordSource = "free" | "universe"

export type GameSettings = {
  /** Whether the idle timeout is enforced. When false the player can pause as
   *  long as they like and only the session timer (or a missed required word)
   *  can end the sprint. */
  idleTimerEnabled: boolean
  /** Seconds without keystrokes before the session ends (when enabled). */
  mainTimerSeconds: number
  /** Total session duration in seconds. The session timer is always on — it is
   *  picked from the home screen's dial rather than the advanced settings, so
   *  there is no "enabled" companion flag. */
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
  /** Whether a sound plays when a new required word appears. */
  soundEnabled: boolean
  /** How the required word is announced when `soundEnabled`: a synthesized
   *  bell, or the browser speaking the word aloud (SpeechSynthesis). */
  soundMode: SoundMode
  /** Where required words are drawn from:
   *  - "free": the backend pool — `/words/related` when `wordSourceSeeds` has
   *    seeds, `/words/random` when empty.
   *  - "universe": always the hardcoded per-locale fallback pool. The
   *    author-driven backend integration is future work; for now the seed
   *    input is accepted but ignored. */
  wordSource: WordSource
  /** Raw, comma-separated seed words for the "free" source
   *  (e.g. "kitchen, food, restaurants"). Parsed at game start; ignored for
   *  the "universe" source. */
  wordSourceSeeds: string
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

/** Session lengths (minutes) offered by the home screen's timer dial. */
export const SESSION_MINUTES = [5, 10, 15, 25, 45] as const

/** Fallback when a stored/preset session length is not one of the dial's
 *  options — the dial has to show something, so it snaps to the default. */
export const DEFAULT_SESSION_MINUTES = 10

export const DEFAULT_SETTINGS: GameSettings = {
  idleTimerEnabled: true,
  mainTimerSeconds: 15,
  globalTimerSeconds: DEFAULT_SESSION_MINUTES * 60,
  requiredWordIntervalEnabled: true,
  requiredWordIntervalSeconds: 30,
  requiredWordUseTimerEnabled: false,
  requiredWordUseTimerSeconds: 20,
  soundEnabled: true,
  soundMode: "bell",
  wordSource: "free",
  wordSourceSeeds: "",
}

// ---------------------------------------------------------------------------
// Presets
// Curated session profiles the user can apply with one click. Each preset
// specifies only the "preset-covered" keys (PRESET_KEYS below). Applying a
// preset merges these into the current settings, leaving everything else
// ("personal" settings such as soundEnabled) untouched.
//
// To add a new personal setting (not controlled by presets):
//   1. Add its key to GameSettings and DEFAULT_SETTINGS.
//   2. Do NOT add it to PRESET_KEYS — that's all it takes.
// ---------------------------------------------------------------------------

// Keys that presets read and write. Everything in GameSettings that is NOT
// listed here is a personal setting: ignored during preset matching and
// untouched when a preset is applied.
export const PRESET_KEYS = [
  "idleTimerEnabled",
  "mainTimerSeconds",
  "globalTimerSeconds",
  "requiredWordIntervalEnabled",
  "requiredWordIntervalSeconds",
  "requiredWordUseTimerEnabled",
  "requiredWordUseTimerSeconds",
] as const

// Subset of PRESET_KEYS compared when deciding which mode card is highlighted.
// `globalTimerSeconds` is deliberately excluded: it is stored in the mode (so
// picking a mode moves the home dial) but the dial is also a first-class
// control of its own, and re-dialling the length should not silently
// un-highlight the mode the player chose.
export const PRESET_MATCH_KEYS = PRESET_KEYS.filter(
  (k) => k !== "globalTimerSeconds",
)

export type PresetKey = (typeof PRESET_KEYS)[number]
export type PresetSettings = Pick<GameSettings, PresetKey>

// System presets shipped with the app. The home screen's mode grid has four
// cells — three system modes plus the challenge of the day — so this list
// MUST stay at 3.
export type PresetId = "classic" | "speed" | "creative"

export type Preset = {
  id: PresetId
  /** Translation key suffix (matches `t.presets[id].name` etc.). */
  settings: PresetSettings
}

export const PRESETS: Preset[] = [
  {
    id: "classic",
    settings: {
      idleTimerEnabled: DEFAULT_SETTINGS.idleTimerEnabled,
      mainTimerSeconds: DEFAULT_SETTINGS.mainTimerSeconds,
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
      idleTimerEnabled: true,
      mainTimerSeconds: 5,
      globalTimerSeconds: 300,
      requiredWordIntervalEnabled: false,
      requiredWordIntervalSeconds: 15,
      requiredWordUseTimerEnabled: false,
      requiredWordUseTimerSeconds: 10,
    },
  },
  {
    id: "creative",
    settings: {
      idleTimerEnabled: true,
      mainTimerSeconds: 10,
      globalTimerSeconds: 600,
      requiredWordIntervalEnabled: true,
      requiredWordIntervalSeconds: 20,
      requiredWordUseTimerEnabled: true,
      requiredWordUseTimerSeconds: 10,
    },
  },
]

/** Build a PresetSettings (the preset-covered subset) from a full GameSettings.
 *  Used when saving the settings panel's current state as a custom preset. */
export function extractPresetSettings(s: GameSettings): PresetSettings {
  return {
    idleTimerEnabled: s.idleTimerEnabled,
    mainTimerSeconds: s.mainTimerSeconds,
    globalTimerSeconds: s.globalTimerSeconds,
    requiredWordIntervalEnabled: s.requiredWordIntervalEnabled,
    requiredWordIntervalSeconds: s.requiredWordIntervalSeconds,
    requiredWordUseTimerEnabled: s.requiredWordUseTimerEnabled,
    requiredWordUseTimerSeconds: s.requiredWordUseTimerSeconds,
  }
}

/** Find which preset (if any) matches the settings object. Compares
 *  `PRESET_MATCH_KEYS`, so the session length is not part of the decision. */
export function findMatchingPreset(s: GameSettings): PresetId | null {
  for (const p of PRESETS) {
    if (PRESET_MATCH_KEYS.every((k) => p.settings[k] === s[k])) return p.id
  }
  return null
}

/** Like `findMatchingPreset` but for a list of user-defined custom presets.
 *  Returns the matching custom preset's id, or null. */
export function findMatchingCustomPreset(
  s: GameSettings,
  presets: ReadonlyArray<{ id: string; settings: PresetSettings }>,
): string | null {
  for (const p of presets) {
    if (PRESET_MATCH_KEYS.every((k) => p.settings[k] === s[k])) return p.id
  }
  return null
}

/** Session length in whole minutes, snapped to one of `SESSION_MINUTES`. */
export function sessionMinutes(s: GameSettings): number {
  const minutes = Math.round(s.globalTimerSeconds / 60)
  return (SESSION_MINUTES as readonly number[]).includes(minutes)
    ? minutes
    : DEFAULT_SESSION_MINUTES
}
