// English translations for Flowfic. This is the canonical dictionary: the
// `Translations` type is derived from it, so every other locale (es.ts, and
// any future sibling) must match this exact shape.

export const en = {
  app: {
    title: "Flowfic",
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
        title: "Welcome to Flowfic",
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
    title: "Advanced settings",
    description: "Fine-tune the timers and the required words.",
    presetsLabel: "Game modes",
    moreOptions: "More options",
    sessionLengthLabel: "Session length",
    // Visible heading above the session dial (the dial's own control keeps the
    // `sessionLengthLabel` accessible name).
    selectDuration: "Select a duration",
    mainTimerLabel: "Idle timeout",
    mainTimerHelp: "Seconds idle before the session ends.",
    idleTimerEnable: "Enable the idle timeout",
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
    start: "Start writing",
    customModesLabel: "Custom modes",
    backToPresetsLabel: "Default modes",
    createPresetLabel: "Save current settings",
    createPresetTooltip: "Save the settings above as a new custom mode.",
    customNamePlaceholder: "Mode name",
    customNameSave: "Save",
    customNameCancel: "Cancel",
    customLimitReached: "You can have at most {max} custom modes.",
    customSaveFailed: "Couldn't save your custom mode.",
    signInForCustomModes: "Sign in to save custom modes.",
  },

  presets: {
    classic: {
      name: "Classic",
      description: "Balanced defaults. A good place to start.",
    },
    speed: {
      name: "Fast",
      description: "Tight idle, no required words. Don't stop.",
    },
    creative: {
      name: "Super creative",
      description: "Required words come constantly. Stay agile.",
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
    pause: "Pause",
    // The session controls are icon-only squares, so these are accessible
    // names rather than visible labels and can carry the full phrase.
    resume: "Resume",
    // Spoken when the sprint freezes or restarts. Pause is reachable without
    // the toggle ever holding focus (the quit dialog pauses too), so the state
    // needs saying outright rather than riding on the button's name.
    pausedStatus: "Session paused. The timers are frozen.",
    resumedStatus: "Session resumed.",
    quit: "Quit session",
    quitConfirmTitle: "Quit this session?",
    quitConfirmDescription:
      "Your sprint ends here and you'll see your stats. The story stays editable afterwards.",
    quitConfirm: "Quit",
    quitCancel: "Keep writing",
    // Final checkout of a finished sprint: save the story and return home.
    finish: "Save story",
    titleLabel: "Story title",
    inspirationShow: "Show inspiration",
    inspirationHide: "Hide inspiration",
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
    empty: "No stories yet — finish a session to see it here.",
    signUpPrompt: "Sign in to see your saved stories here.",
    error: "Couldn't load stories.",
    rowMenuLabel: "Story options",
    deleteStory: "Delete",
    deleteStoryConfirmTitle: "Delete this story?",
    deleteStoryConfirmDescription:
      "This permanently removes the story. This action cannot be undone.",
    deleteStoryConfirm: "Delete",
    deleteStoryCancel: "Cancel",
    deleteStoryFailed: "Couldn't delete that story.",
    // Heads the My-stories list. The library's size lives here rather than on
    // the profile screen, next to the stories themselves.
    storyCount: "{count} stories",
    resultCount: "{count} matching",
    loadMore: "Load more",
    loadingMore: "Loading…",
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
    // The header toggle is icon-only, so its accessible name has to say what a
    // click does rather than name the control.
    modeSwitchToDark: "Switch to dark mode",
    modeSwitchToLight: "Switch to light mode",
    languageLabel: "Language",
  },

  auth: {
    logIn: "Log in",
    logOut: "Log out",
    title: "Sign in to Flowfic",
    description:
      "You can play without an account. Sign in to unlock saved stories and leaderboards (coming soon).",
    continueWith: "Continue with {provider}",
    google: "Google",
    finishingSignIn: "Finishing sign-in…",
    signInFailed: "Sign-in failed.",
    backToGame: "Back to the game",
    accountMenuLabel: "Account menu",
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
    home: "Home",
    stories: "My stories",
    progress: "My Progress",
    challenges: "Challenges",
    stats: "Statistics",
    achievements: "Achievements",
    showAll: "Show all",
    // Header title of the landing screen — the one screen with no title of its
    // own, named after what it is for.
    createStory: "Create a story",
    backToHome: "Back to home",
    // Back-arrow label on a single story / a not-found reached from one, where
    // the arrow returns to the stories list rather than the landing.
    backToStories: "Back to my stories",
  },

  // Client-rendered not-found screen: shown for an unknown path or a story id
  // that doesn't resolve. There is no server 404 — the SPA shell is served for
  // every app path (see prod/conf/Caddyfile), so the app decides not-found.
  notFound: {
    title: "Page not found",
    body: "We couldn't find what you were looking for.",
    backHome: "Back to home",
  },

  // Home dashboard + shared gamification copy.
  dashboard: {
    back: "Back",
    level: "Level",
    signInHint: "Sign in to save stories and track your progress.",
    daysInARow: "days in a row",
    weeklySummary: "Weekly summary",
    sessions: "sessions",
    words: "words",
    totalTime: "total time",
    untitledStory: "Untitled story",
    today: "Today",
    emptyStories: "No stories yet — finish a sprint to see it here.",
    // Heading of the words-per-day chart. Named for what it will become: the
    // week/month range buttons will drive it and the summary beside it together.
    timeline: "Timeline",
    chartCaption: "Words written per day over the last 7 days.",
    minutes: "minutes",
    challengeOfDay: "Challenge of the day",
    challengeOfDayHint: "Jump straight in",
    recentStories: "Recent stories",
    inspirationAlt: "Inspiration image",
    inspirationPrompt: "Click here to get some inspiration",
    inspirationAnother: "Show me another inspiration",
    inspirationUnavailable: "No inspiration available right now.",
    // The landing's three circular selectors and the pane they fill. These sit
    // INSIDE the circles, so they have to stay short in both languages. The
    // inspiration one is the only selector that is also an action: once
    // selected it re-rolls, so it says so.
    showcaseLabel: "Choose what to show",
    showcasePaneLabel: "Showing: {name}",
    inspirationTabCurrent: "Inspiration",
    inspirationTabAnother: "Click for another",
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
    dailyGroup: "Daily challenges",
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
