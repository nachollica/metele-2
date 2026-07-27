// English translations for FLOWFIC. This is the canonical dictionary: the
// `Translations` type is derived from it, so every other locale (es.ts, and
// any future sibling) must match this exact shape.

export const en = {
  app: {
    title: "Flowfic",
    tagline: "A writing game. Keep your hands moving.",
    loading: "Loading FLOWFIC…",
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
        title: "Welcome to FLOWFIC",
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
    requiredWordsLabel: "Required words",
    requiredWordsHelp: "Words appear as you write. Type them before they fade.",
    wordSourceLabel: "Word source",
    wordSourceFree: "Free words",
    wordSourceUniverse: "Story world",
    wordSourceSeedsLabel: "Word seeds",
    wordSourceSeedsPlaceholder: "kitchen, food, restaurants",
    wordSourceUniversePlaceholder: "e.g. Franz Kafka",
    soundLabel: "Sound on new word",
    soundHelp: "Play a sound each time a required word appears.",
    soundEnable: "Enable word sound",
    soundModeLabel: "Sound type",
    soundBell: "Bell",
    soundSpeak: "Speak the word",
    loadingWords: "Loading words…",
    secondsSuffix: "s",
    minutesSuffix: "m",
    start: "Start writing",
    customModesLabel: "Custom game modes",
    customModesDescription: "Your saved presets. Click to apply.",
    customModesTooltip: "Edit or delete your custom modes from your profile.",
    backToPresetsLabel: "Back to original presets",
    backToPresetsDescription: "Show the built-in game modes.",
    createPresetLabel: "Save current settings",
    createPresetTooltip: "Save the settings above as a new custom mode.",
    customNamePlaceholder: "Mode name",
    customNameSave: "Save",
    customNameCancel: "Cancel",
    customLimitReached: "You can have at most {max} custom modes.",
    customEmptySlot: "Empty slot",
    customSaveFailed: "Couldn't save your custom mode.",
    signInForCustomModes: "Sign in to save custom modes.",
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
    nolimit: {
      name: "No Limit",
      description: "No global timer, slower words, play as long as you want.",
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
    quit: "Quit session",
    createStory: "Create a story",
    viewingStory: "Viewing a previous story (read-only).",
    saveFailed: "Couldn't save your last story.",
    saveRetry: "Retry",
    saveRetrying: "Retrying…",
    saveDismiss: "Dismiss",
  },

  profile: {
    title: "Your profile",
    description: "Edit how your name, email and avatar appear in the app.",
    nameLabel: "Display name",
    emailLabel: "Email",
    emailInvalid: "Enter a valid email address.",
    uploadPicture: "Upload picture",
    removePicture: "Remove picture",
    pictureTooLarge: "Pick an image smaller than 256 KB.",
    pictureReadFailed: "Couldn't read that file.",
    storyCountLabel: "Stories written",
    save: "Save changes",
    saving: "Saving…",
    saved: "Saved.",
    saveFailed: "Couldn't save your changes.",
    menuItem: "Profile",
    customPresetEdit: "Rename",
    customPresetDelete: "Delete",
    customPresetSave: "Save",
    customPresetCancel: "Cancel",
    customPresetDeleteConfirm: "Delete this custom mode?",
    customPresetDeleteConfirmDescription:
      "This permanently removes the custom mode. This action cannot be undone.",
    customPresetDeleteFailed: "Couldn't delete that custom mode.",
    customPresetRenameFailed: "Couldn't rename that custom mode.",
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

  sidebar: {
    title: "Recent stories",
    subtitle: "Your latest writing sessions",
    empty: "No stories yet — finish a session to see it here.",
    signUpPrompt: "Sign up to see your saved stories here.",
    error: "Couldn't load stories.",
    toggle: "Open recent stories",
    toggleShort: "Stories",
    durationLabel: "Session length",
    rowMenuLabel: "Story options",
    deleteStory: "Delete",
    deleteStoryConfirmTitle: "Delete this story?",
    deleteStoryConfirmDescription:
      "This permanently removes the story. This action cannot be undone.",
    deleteStoryConfirm: "Delete",
    deleteStoryCancel: "Cancel",
    deleteStoryFailed: "Couldn't delete that story.",
    renameStory: "Rename",
    renameStoryLabel: "Story title",
    renameSave: "Save title",
    renameCancel: "Cancel rename",
    searchPlaceholder: "Search your stories…",
    filterByDate: "Any date",
    filterClear: "Clear",
    sortLabel: "Sort order",
    sortNewest: "Newest",
    sortOldest: "Oldest",
    noResults: "No stories match your search.",
  },

  prefs: {
    sectionLabel: "Preferences",
    modeLabel: "Mode",
    modeLight: "Light",
    modeDark: "Dark",
    languageLabel: "Language",
  },

  auth: {
    signedOut: "Sign in",
    signedIn: "Account",
    logIn: "Log in",
    logOut: "Log out",
    title: "Sign in to FLOWFIC",
    description:
      "You can play without an account. Sign in to unlock saved stories and leaderboards (coming soon).",
    continueWith: "Continue with {provider}",
    google: "Google",
    facebook: "Facebook",
    twitter: "X (Twitter)",
    finishingSignIn: "Finishing sign-in…",
    signInFailed: "Sign-in failed.",
    signInFailedRetry: "Try again",
    backToGame: "Back to the game",
    welcomeBack: "Welcome back, {name}",
    accountMenuLabel: "Account menu",
    profileEmail: "Email",
    devUserLogin: "Dev user login",
    devUsernameLabel: "Dev username",
    devUsernamePlaceholder: "username",
    devLoginSubmit: "Log in as dev user",
    devUserNotFound: "No dev user with that username. Seed it first.",
    devLoginFailed: "Dev login failed. Make sure the backend is running.",
    providersDivider: "with a provider",
    emailInvalid: "Enter a valid email address.",
  },

  nav: {
    label: "Main navigation",
    openMenu: "Open menu",
    home: "Home",
    stories: "My stories",
    challenges: "Challenges",
    stats: "Statistics",
    achievements: "Achievements",
  },

  // Home dashboard + shared gamification copy.
  dashboard: {
    subtitle: "Ready to enter the flow?",
    back: "Back",
    level: "Level",
    signInHint: "Sign in to save stories and track your progress.",
    streakTitle: "Your current streak",
    daysInARow: "days in a row",
    weeklySummary: "Weekly summary",
    sessions: "sessions",
    words: "words",
    totalTime: "total time",
    untitledStory: "Untitled story",
    today: "Today",
    emptyStories: "No stories yet — finish a sprint to see it here.",
    progressTitle: "Your progress",
    thisWeek: "This week",
    chartCaption: "Words written per day over the last 7 days.",
    wordsWritten: "Words written",
    writingTime: "Writing time",
    sessionsCompleted: "Sessions completed",
    promptOfDay: "Prompt of the day",
    writeNow: "Write now",
  },

  achievements: {
    unlockedSummary: "{count} of {total} unlocked",
    items: {
      first_session: { name: "First step", description: "Complete your first sprint" },
      streak_7: { name: "Consistent writer", description: "Write 7 days in a row" },
      streak_30: { name: "Unstoppable", description: "Write 30 days in a row" },
      wordsmith: { name: "Wordsmith", description: "Write 10,000 words in total" },
      marathon: { name: "Marathoner", description: "Write for 5 hours in total" },
      big_session: { name: "In the zone", description: "Write 750 words in one sprint" },
      night_owl: { name: "Night owl", description: "Write a sprint after midnight" },
      early_bird: { name: "Early bird", description: "Write a sprint at dawn" },
    },
  },

  challenges: {
    completed: "Completed",
    items: {
      daily_600: { name: "Daily sprint", description: "Write 600 words today" },
      weekly_5_sessions: { name: "Five a week", description: "Complete 5 sprints this week" },
      keep_streak: { name: "Keep the flame", description: "Write today to keep your streak" },
    },
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
