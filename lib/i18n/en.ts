// English translations for METELE.
// More languages can be added later by creating sibling files (e.g. es.ts) with the same shape.

export const en = {
  app: {
    title: "METELE",
    tagline: "A writing game. Keep your hands moving.",
  },

  settings: {
    title: "Session settings",
    description: "Pick a preset or fine-tune the rules below.",
    presetsLabel: "Quick presets",
    mainTimerLabel: "Idle timeout",
    mainTimerHelp: "Seconds with no keystrokes before the session ends.",
    globalTimerLabel: "Session length",
    globalTimerHelp: "Total session duration. Disable for an open-ended run.",
    globalTimerEnable: "Limit session length",
    requiredWordIntervalLabel: "New required word every",
    requiredWordIntervalHelp:
      "Average time between new required words. Actual intervals are randomized around this value.",
    requiredWordUseTimerLabel: "Time to use the required word",
    requiredWordUseTimerHelp:
      "If the latest required word isn't used within this time, the session ends.",
    requiredWordUseTimerEnable: "Enforce required-word deadline",
    bellLabel: "Play a bell when a new required word appears",
    secondsSuffix: "s",
    start: "Start writing",
  },

  presets: {
    classic: {
      name: "Classic",
      description: "Balanced defaults for a 5-minute session.",
    },
    speed: {
      name: "Speed typing",
      description: "Tight idle, fast new words. Don't stop.",
    },
    relaxed: {
      name: "Relaxed",
      description: "No global timer, slower words, gentler deadlines.",
    },
    creative: {
      name: "Too creative",
      description: "Required words come constantly. Stay agile.",
    },
    marathon: {
      name: "Marathon",
      description: "25 minutes of steady writing pressure.",
    },
  },

  game: {
    requiredWordHeader: "Required word",
    noRequiredWord: "Keep writing…",
    useWordIn: "Use it in",
    idleEndsIn: "Idle timeout in",
    sessionEndsIn: "Session ends in",
    characters: "characters",
    placeholder: "Begin your story. Don't stop typing…",
    pause: "Give up",
  },

  results: {
    title: "Session ended",
    reasonIdle: "You stopped typing for too long.",
    reasonGlobal: "Time's up — your session length was reached.",
    reasonUnusedWord: "You didn't use the required word in time.",
    reasonManual: "You ended the session.",
    duration: "Duration",
    characters: "Characters written",
    words: "Words",
    requiredWordsUsed: "Required words used",
    yourStory: "Your story",
    playAgain: "Play again",
    copyStory: "Copy story",
    copied: "Copied!",
  },

  units: {
    seconds: "s",
    minutes: "m",
  },
} as const

export type Translations = typeof en
