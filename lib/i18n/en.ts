// English translations for METELE.
// More languages can be added later by creating sibling files (e.g. es.ts) with the same shape.

export const en = {
  app: {
    title: "METELE",
    tagline: "A writing game. Keep your hands moving.",
  },

  welcome: {
    dontShowAgain: "Don't show this again",
    start: "Got it",
    next: "Next",
    back: "Back",
    skipTutorial: "Skip tutorial",
    stepLabel: "Step {current} of {total}",
    goToStep: "Go to step {n}",
    items: {
      intro: {
        title: "Welcome to METELE",
        body: "A writing game where your hands keep moving. Quick rules before you start.",
      },
      pickVelocity: {
        title: "Pick your velocity",
        body: "Pick a preset or tune the timers on the next screen.",
      },
      createStory: {
        title: "Write non-stop",
        body: "Keep typing in the main area. Stay idle too long and the session ends.",
      },
      requiredWords: {
        title: "Required words",
        body: "Words pop up while you write. Use them or let them fade. Enable the deadline rule to penalize unused words.",
      },
      shareSave: {
        title: "Review and refine",
        body: "When the session ends you see your stats, then return to the story to edit or copy it.",
      },
    },
  },

  settings: {
    title: "Session settings",
    description: "Pick a preset or tweak below.",
    presetsLabel: "Quick presets",
    mainTimerLabel: "Idle timeout",
    mainTimerHelp: "Seconds idle before the session ends.",
    globalTimerLabel: "Session length",
    globalTimerHelp: "Total session length. Disable for open-ended.",
    globalTimerEnable: "Limit session length",
    requiredWordIntervalEnable: "Enable required words",
    requiredWordIntervalLabel: "New required word every",
    requiredWordIntervalHelp: "Average gap between new words; randomized.",
    requiredWordUseTimerLabel: "Time to use the required word",
    requiredWordUseTimerHelp:
      "On: unused words end the session. Off: words fade after a few seconds.",
    requiredWordUseTimerEnable: "Enforce required-word deadline",
    bellLabel: "Bell when a new required word appears",
    categoryWordsLabel: "Custom word categories",
    categoryWordsHelp:
      "Comma-separated seed words. Required words drawn from a related pool.",
    categoryWordsEnable: "Use custom word categories",
    categoryWordsPlaceholder: "kitchen, food, restaurants",
    categoryWordsLoading: "Loading category words…",
    categoryWordsError: "Couldn't fetch category words. Using default pool.",
    secondsSuffix: "s",
    minutesSuffix: "m",
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
    chaos: {
      name: "Chaos mode",
      description: "Brutal idle, words raining down. Survive if you can.",
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
    startAgain: "Start again",
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
    close: "Continue editing",
  },

  units: {
    seconds: "s",
    minutes: "m",
  },

  auth: {
    signedOut: "Sign in",
    signedIn: "Account",
    logIn: "Log in",
    logOut: "Log out",
    signUp: "Create account",
    title: "Sign in to METELE",
    description:
      "You can play without an account. Sign in to unlock saved stories and leaderboards (coming soon).",
    continueWith: "Continue with {provider}",
    google: "Google",
    instagram: "Instagram",
    facebook: "Facebook",
    or: "or",
    tryMock: "Try mock account (dev)",
    cancel: "Maybe later",
    finishingSignIn: "Finishing sign-in…",
    signInFailed: "Sign-in failed.",
    signInFailedRetry: "Try again",
    backToGame: "Back to the game",
    welcomeBack: "Welcome back, {name}",
    accountMenuLabel: "Account menu",
    profileEmail: "Email",
    profileProvider: "Signed in with {provider}",
  },
} as const

// Widen literal types from `as const` so other locales (es, future ones)
// with different string values still satisfy the shape.
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : { [K in keyof T]: Widen<T[K]> }

export type Translations = Widen<typeof en>
