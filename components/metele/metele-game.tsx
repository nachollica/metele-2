"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { ArrowLeft, Loader2, Pencil, RotateCcw, X } from "lucide-react"

import { AppHeader, PrimaryActionButton } from "./app-header"
import { AppShell } from "./app-shell"
import { GameHud } from "./game-hud"
import { ProfilePanel } from "./profile-panel"
import { ResultsModal } from "./results-modal"
import { SettingsPanel } from "./settings-panel"
import { WelcomeModal } from "./welcome-modal"
import { WritingArea } from "./writing-area"

import { pickRequiredWord, matchesWord, normalizeForMatch } from "@/lib/metele/words"
import { fetchRelatedWords, parseCategoriesInput } from "@/lib/metele/words-api"
import { createStory, type Story } from "@/lib/metele/stories-api"
import { useAuth } from "@/lib/auth"
import { useLocale, useTranslations } from "@/lib/i18n"
import { usePreferences } from "@/lib/preferences"
import { playBell, primeAudio } from "@/lib/metele/sound"
import { randomIntervalMs } from "@/lib/metele/random"
import {
  DEFAULT_SETTINGS,
  type EndReason,
  type GameResult,
  type GameSettings,
  type MatchedRange,
} from "@/lib/metele/types"

type GameState =
  | "welcome"
  | "settings"
  | "loading"
  | "playing"
  | "ended"
  | "viewing"
  | "profile"

// Max time we'll block the user on the categories backend call. After this
// the game starts with the hardcoded fallback pool while the request (if it
// ever resolves) is silently discarded.
const CATEGORIES_FETCH_TIMEOUT_MS = 2500

const WELCOME_STORAGE_KEY = "metele.welcome.dismissed"

// Word delimiter characters: when one of these is the most recent character,
// the word that just ended is finalized and (if a required word is active)
// compared to it.
const WORD_DELIMITERS = /[\s.,;:!?'"()[\]{}\-—–…/\\]/

// Tick interval for UI countdowns. We use a single 100ms interval for all
// cosmetic countdowns, while game-ending events use independent timeouts so
// they remain accurate even if the tab is throttled.
const UI_TICK_MS = 100

// When the "use word in N seconds" deadline is disabled, required words still
// disappear automatically after this many seconds (whether or not the player
// used them). No game-over is triggered.
const WORD_AUTO_DISMISS_MS = 7_000

export function MeteleGame() {
  const locale = useLocale()
  const t = useTranslations()
  const { getAccessToken, status: authStatus } = useAuth()
  const { bellEnabled: bellPref, setBellEnabled: setBellPref } = usePreferences()

  // ---- High-level game state ---------------------------------------------
  const [gameState, setGameState] = useState<GameState>("welcome")
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [result, setResult] = useState<GameResult | null>(null)
  // Visibility of the post-session stats modal. Independent from `gameState`
  // because the player can dismiss the modal and remain in the "ended" state
  // with an editable read-only-of-rules game area.
  const [resultsModalOpen, setResultsModalOpen] = useState(false)
  // Whether timers are actually running. Stays false from `startGame` until the
  // first real text modification, so the player isn't penalized for the time
  // between clicking Start and beginning to type.
  const [armed, setArmed] = useState(false)
  // Bumped after a successful POST so the sidebar refetches.
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0)
  // When the user opens the profile screen we stash the screen they were on
  // here so "Go back" can restore it. `null` means we're not currently
  // showing the profile.
  const previousStateRef = useRef<GameState | null>(null)
  // Wall-clock at which the profile screen was opened from "playing". On
  // resume we shift `startedAtRef` and `lastInputAtRef` by the elapsed pause
  // so countdowns pick up from the same remaining time the player saw when
  // they left.
  const pausedAtRef = useRef<number | null>(null)

  // Skip the welcome modal if the user previously opted out, or is logged in.
  // The auth check waits for `authStatus` to resolve so we don't flash the
  // modal while Auth0 is still rehydrating the session on page load.
  useEffect(() => {
    setGameState((current) => {
      if (current !== "welcome") return current
      if (authStatus === "authenticated") return "settings"
      if (typeof window !== "undefined") {
        try {
          if (window.localStorage.getItem(WELCOME_STORAGE_KEY) === "1") {
            return "settings"
          }
        } catch {
          // localStorage unavailable; fall through to keep the welcome modal.
        }
      }
      return current
    })
  }, [authStatus])

  function dismissWelcome(dontShowAgain: boolean) {
    if (dontShowAgain && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(WELCOME_STORAGE_KEY, "1")
      } catch {
        // ignore
      }
    }
    setGameState("settings")
  }

  // ---- Live game data ----------------------------------------------------
  const [text, setText] = useState("")
  const [matches, setMatches] = useState<MatchedRange[]>([])
  const [currentRequiredWord, setCurrentRequiredWord] = useState<string | null>(null)

  // Cosmetic countdowns (re-rendered each UI_TICK_MS).
  const [now, setNow] = useState(() => Date.now())

  // ---- Refs (no re-render needed) ----------------------------------------
  const textRef = useRef("")
  const usedWordsRef = useRef<Set<string>>(new Set())
  const startedAtRef = useRef<number>(0)
  const lastInputAtRef = useRef<number>(0)
  // When the *current* required word was spawned. Used to compute the
  // "use it in N seconds" countdown displayed in the HUD.
  const wordSpawnedAtRef = useRef<number | null>(null)
  const currentWordRef = useRef<string | null>(null)
  // Cache the active settings so timer callbacks don't depend on the closure
  // captured at start time and stay correct across replays.
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS)

  // Bell is persisted per-user in localStorage (via PreferencesProvider).
  // When the stored pref hydrates, mirror it into the active settings.
  // Writes go the other direction through `handleSettingsChange`.
  useEffect(() => {
    if (bellPref === null) return
    setSettings((s) =>
      s.bellEnabled === bellPref ? s : { ...s, bellEnabled: bellPref },
    )
    settingsRef.current = { ...settingsRef.current, bellEnabled: bellPref }
  }, [bellPref])

  const handleSettingsChange = useCallback(
    (next: GameSettings) => {
      setSettings(next)
      if (next.bellEnabled !== bellPref) setBellPref(next.bellEnabled)
    },
    [bellPref, setBellPref],
  )

  // Active custom word pool fetched from the backend at game start. Null
  // means "use the hardcoded per-locale pool" (categories disabled, no input,
  // or backend call failed).
  const customPoolRef = useRef<readonly string[] | null>(null)

  // Independent timers for game-ending events.
  const idleTimeoutRef = useRef<number | null>(null)
  const globalTimeoutRef = useRef<number | null>(null)
  // The "spawn next required word" timer. Only runs when there is NO active
  // required word; it is canceled on spawn and re-armed when the word is
  // consumed by the player.
  const wordSpawnTimeoutRef = useRef<number | null>(null)
  const wordUseTimeoutRef = useRef<number | null>(null)
  const uiTickRef = useRef<number | null>(null)
  // Stable ref to armSpawnTimer so the auto-dismiss timeout can schedule the
  // next spawn without creating a circular useCallback dep.
  const armSpawnTimerRef = useRef<() => void>(() => {})

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Keep the latest text in a ref so timer callbacks can read it without
  // becoming stale closures.
  useEffect(() => {
    textRef.current = text
  }, [text])

  useEffect(() => {
    currentWordRef.current = currentRequiredWord
  }, [currentRequiredWord])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // ---- Timer helpers -----------------------------------------------------
  const clearAllTimers = useCallback(() => {
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }
    if (globalTimeoutRef.current !== null) {
      window.clearTimeout(globalTimeoutRef.current)
      globalTimeoutRef.current = null
    }
    if (wordSpawnTimeoutRef.current !== null) {
      window.clearTimeout(wordSpawnTimeoutRef.current)
      wordSpawnTimeoutRef.current = null
    }
    if (wordUseTimeoutRef.current !== null) {
      window.clearTimeout(wordUseTimeoutRef.current)
      wordUseTimeoutRef.current = null
    }
    if (uiTickRef.current !== null) {
      window.clearInterval(uiTickRef.current)
      uiTickRef.current = null
    }
  }, [])

  const endGame = useCallback(
    (reason: EndReason) => {
      // Snapshot stats before tearing things down.
      const finalText = textRef.current
      const durationMs = startedAtRef.current === 0 ? 0 : Date.now() - startedAtRef.current
      const trimmed = finalText.trim()
      const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length

      clearAllTimers()
      // Freeze the HUD's `now` reference so all derived countdowns reflect the
      // moment of game-over and stay there for the post-session edit screen.
      setNow(Date.now())
      setGameState("ended")
      setResultsModalOpen(true)
      setResult({
        reason,
        durationMs,
        characters: finalText.length,
        words: wordCount,
        requiredWordsUsed: usedWordsRef.current.size,
        text: finalText,
      })
    },
    [clearAllTimers],
  )

  // Close the post-session stats modal. The player remains in the "ended"
  // state with an editable text area but no timers/required words.
  const closeResultsModal = useCallback(() => {
    setResultsModalOpen(false)
  }, [])

  // Return to the settings screen to start a new session. Persists the just-
  // finished session to the backend so it shows up in the sidebar. The POST
  // is fire-and-forget — sidebar refetches once it resolves. Anonymous users
  // (no access token) silently skip the POST since `/stories` requires auth.
  const startAgain = useCallback(() => {
    const finalText = textRef.current.trim()
    if (finalText.length > 0 && result !== null) {
      const payload = {
        text: textRef.current,
        lang: locale,
        settings: settingsRef.current as unknown as Record<string, unknown>,
        stats: {
          reason: result.reason,
          durationMs: result.durationMs,
          characters: result.characters,
          words: result.words,
          requiredWordsUsed: result.requiredWordsUsed,
        } as Record<string, unknown>,
      }
      void getAccessToken().then((token) => {
        if (token === null) return
        return createStory(token, payload).then((created) => {
          if (created !== null) {
            setStoriesRefreshKey((k) => k + 1)
          }
        })
      })
    }
    setResultsModalOpen(false)
    setGameState("settings")
  }, [getAccessToken, locale, result])

  // Load a story from the sidebar into the main pane in read-only viewing
  // mode. Tears down any timers (in case the user clicked while the game was
  // running) and shows just the text — no HUD, no settings, no stats modal.
  const viewStory = useCallback(
    (story: Story) => {
      clearAllTimers()
      setResultsModalOpen(false)
      setMatches([])
      setCurrentRequiredWord(null)
      currentWordRef.current = null
      setText(story.text)
      textRef.current = story.text
      // The user could have come from the profile screen via the sidebar;
      // jumping out of profile this way invalidates any pending
      // "go back to previous" breadcrumb, so reset it.
      previousStateRef.current = null
      pausedAtRef.current = null
      setGameState("viewing")
    },
    [clearAllTimers],
  )

  // Exit the read-only story view back to settings.
  const closeStoryView = useCallback(() => {
    setText("")
    textRef.current = ""
    previousStateRef.current = null
    pausedAtRef.current = null
    setGameState("settings")
  }, [])

  // ---- Profile screen ----------------------------------------------------
  // Open the profile pane, remembering the screen we came from so "Go back"
  // can restore it. When the user is in the middle of an active session we
  // pause: timers are cleared and the wall-clock is captured so the same
  // remaining time can be restored on resume. Any other prior state (welcome
  // / settings / ended / viewing) just sets the breadcrumb — no clocks are
  // running.
  const openProfile = useCallback(() => {
    // Already on the profile screen — no-op rather than clobbering the
    // saved breadcrumb. (The dropdown menu item is still rendered there
    // because the AuthButton is shared across screens.)
    if (gameState === "profile") return
    previousStateRef.current = gameState
    if (gameState === "playing") {
      pausedAtRef.current = Date.now()
      clearAllTimers()
    } else {
      pausedAtRef.current = null
    }
    setGameState("profile")
  }, [clearAllTimers, gameState])

  // Re-arm the timers that were running before the profile was opened so a
  // resumed session picks up where it left off. Mirrors `armTimers` but
  // bases each schedule on remaining time computed from `lastInputAtRef` /
  // `startedAtRef`, not on wall-clock now.
  const resumePlaying = useCallback(() => {
    const currentSettings = settingsRef.current

    const idleRemainingMs = Math.max(
      0,
      currentSettings.mainTimerSeconds * 1000 -
        (Date.now() - lastInputAtRef.current),
    )
    if (idleRemainingMs <= 0) {
      endGame("idle")
      return
    }
    idleTimeoutRef.current = window.setTimeout(() => {
      endGame("idle")
    }, idleRemainingMs)

    if (currentSettings.globalTimerEnabled) {
      const globalRemainingMs = Math.max(
        0,
        currentSettings.globalTimerSeconds * 1000 -
          (Date.now() - startedAtRef.current),
      )
      if (globalRemainingMs <= 0) {
        endGame("global")
        return
      }
      globalTimeoutRef.current = window.setTimeout(() => {
        endGame("global")
      }, globalRemainingMs)
    }

    if (currentSettings.requiredWordIntervalEnabled) {
      // Spawn-cycle resumes from a fresh interval — preserving the exact
      // unspent fraction of an exponential interval gains nothing UX-wise
      // and complicates the model. Use the ref instead of the closure-bound
      // `armSpawnTimer` to keep the deps array on this callback small.
      armSpawnTimerRef.current()
    }

    uiTickRef.current = window.setInterval(() => {
      setNow(Date.now())
    }, UI_TICK_MS)
  }, [endGame])

  const goBackFromProfile = useCallback(() => {
    const previous = previousStateRef.current ?? "settings"
    previousStateRef.current = null
    if (previous === "playing") {
      const savedPausedAt = pausedAtRef.current
      pausedAtRef.current = null
      // If the player hadn't typed anything yet (timers never armed), there
      // is nothing to resume — the timers will start on the first keystroke.
      // Skipping the resume math also avoids the corner case where the
      // ref-based idle math computes a negative remaining and immediately
      // ends the session right after the user clicks "Go back".
      if (!armed || savedPausedAt === null) {
        setGameState("playing")
        window.setTimeout(() => textareaRef.current?.focus(), 0)
        return
      }
      // Shift the timer reference points forward by the wall-clock time
      // spent in the profile screen so the remaining countdown values are
      // the same as when the player left.
      const elapsedPausedMs = Date.now() - savedPausedAt
      lastInputAtRef.current += elapsedPausedMs
      startedAtRef.current += elapsedPausedMs
      if (wordSpawnedAtRef.current !== null) {
        wordSpawnedAtRef.current += elapsedPausedMs
      }
      setGameState("playing")
      resumePlaying()
      window.setTimeout(() => textareaRef.current?.focus(), 0)
      return
    }
    setGameState(previous)
  }, [armed, resumePlaying])

  // ---- Required word lifecycle ------------------------------------------
  // Spawning ONLY happens via this function. It selects a new word and arms
  // the word-lifecycle timer:
  //   - With deadline: timer ends the game ("unused-word") if the word isn't
  //     typed in time. The next spawn is scheduled by `armSpawnTimer`, which
  //     is called from `checkLatestWord` when the player matches.
  //   - Without deadline: timer silently dismisses the word after
  //     WORD_AUTO_DISMISS_MS and arms the next spawn directly.
  const spawnRequiredWord = useCallback(() => {
    const currentSettings = settingsRef.current
    const next = pickRequiredWord(
      locale,
      usedWordsRef.current,
      customPoolRef.current ?? undefined,
    )
    setCurrentRequiredWord(next)
    // Mirror into the ref synchronously so input handlers running before
    // the next render still see the active word.
    currentWordRef.current = next
    wordSpawnedAtRef.current = Date.now()

    if (currentSettings.bellEnabled) {
      playBell()
    }

    // (Re)arm the word lifecycle timer.
    if (wordUseTimeoutRef.current !== null) {
      window.clearTimeout(wordUseTimeoutRef.current)
      wordUseTimeoutRef.current = null
    }
    if (currentSettings.requiredWordUseTimerEnabled) {
      // Deadline mode: game over if word not used in time.
      wordUseTimeoutRef.current = window.setTimeout(() => {
        if (currentWordRef.current !== null) {
          endGame("unused-word")
        }
      }, currentSettings.requiredWordUseTimerSeconds * 1000)
    } else {
      // No-deadline mode: word quietly disappears after WORD_AUTO_DISMISS_MS,
      // then `armSpawnTimer` schedules the next word.
      wordUseTimeoutRef.current = window.setTimeout(() => {
        if (currentWordRef.current === null) return
        setCurrentRequiredWord(null)
        currentWordRef.current = null
        wordSpawnedAtRef.current = null
        wordUseTimeoutRef.current = null
        armSpawnTimerRef.current()
      }, WORD_AUTO_DISMISS_MS)
    }
  }, [endGame, locale])

  // Schedule the next required word using a randomized interval.
  // The configured `requiredWordIntervalSeconds` is the average; actual intervals
  // are sampled from an exponential distribution centered on that average.
  // This is the "sleeping" interval: it only runs while NO required word is
  // active. Calling this while a word is still active is a no-op — the prior
  // schedule (if any) is cleared but no new one is armed.
  const armSpawnTimer = useCallback(() => {
    if (wordSpawnTimeoutRef.current !== null) {
      window.clearTimeout(wordSpawnTimeoutRef.current)
      wordSpawnTimeoutRef.current = null
    }
    // Don't schedule while a word is unanswered.
    if (currentWordRef.current !== null) return
    const intervalMs = randomIntervalMs(settingsRef.current.requiredWordIntervalSeconds)
    wordSpawnTimeoutRef.current = window.setTimeout(() => {
      wordSpawnTimeoutRef.current = null
      spawnRequiredWord()
    }, intervalMs)
  }, [spawnRequiredWord])

  // Keep the ref pointing at the latest armSpawnTimer so the auto-dismiss
  // timeout in `spawnRequiredWord` can call it without a circular dep.
  useEffect(() => {
    armSpawnTimerRef.current = armSpawnTimer
  }, [armSpawnTimer])

  // ---- Idle timeout ------------------------------------------------------
  const armIdleTimeout = useCallback(() => {
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current)
    }
    idleTimeoutRef.current = window.setTimeout(() => {
      endGame("idle")
    }, settingsRef.current.mainTimerSeconds * 1000)
  }, [endGame])

  // ---- Start / restart ---------------------------------------------------
  // Actually transition into the playing state with the (possibly null)
  // custom pool already resolved. Pure: no async work happens here.
  const beginPlaying = useCallback(
    (newSettings: GameSettings, pool: readonly string[] | null) => {
      // Reset all in-game state.
      setSettings(newSettings)
      settingsRef.current = newSettings
      setText("")
      setMatches([])
      setCurrentRequiredWord(null)
      setResult(null)
      textRef.current = ""
      currentWordRef.current = null
      usedWordsRef.current = new Set()
      customPoolRef.current = pool && pool.length > 0 ? pool : null

      // Timers stay disarmed until the first real input — see `armTimers`.
      startedAtRef.current = 0
      lastInputAtRef.current = 0
      wordSpawnedAtRef.current = null

      clearAllTimers()
      setArmed(false)
      setGameState("playing")

      // Warm up the audio context inside the user gesture from the Start
      // button so the first bell can play even on strict mobile browsers.
      if (newSettings.bellEnabled) {
        primeAudio()
      }

      // Focus the textarea so the player can type immediately.
      window.setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [clearAllTimers],
  )

  // Entry point invoked by the SettingsModal's "Start writing" button.
  // If the user opted into custom categories, show a spinner while we fetch
  // the related-words pool, racing the request against
  // CATEGORIES_FETCH_TIMEOUT_MS. Whichever finishes first wins; on timeout
  // or any failure we start with the hardcoded fallback pool. The backend
  // is purely opportunistic — the static frontend works without it.
  const startGame = useCallback(
    (newSettings: GameSettings) => {
      const seeds =
        newSettings.requiredWordIntervalEnabled &&
        newSettings.categoryWordsEnabled
          ? parseCategoriesInput(newSettings.categoryWordsInput)
          : []

      if (seeds.length === 0) {
        beginPlaying(newSettings, null)
        return
      }

      setGameState("loading")

      let resolved = false
      const timeout = new Promise<null>((resolve) =>
        window.setTimeout(() => resolve(null), CATEGORIES_FETCH_TIMEOUT_MS),
      )
      const fetchPool = (async (): Promise<string[] | null> => {
        const token = await getAccessToken()
        if (token === null) return null
        return fetchRelatedWords(token, seeds, locale)
      })()
      Promise.race([fetchPool, timeout]).then((pool) => {
        if (resolved) return
        resolved = true
        if (pool === null) {
          console.log(
            "[metele] no custom word pool (anonymous, timeout, or backend unreachable); using hardcoded pool",
          )
        }
        beginPlaying(newSettings, pool)
      })
    },
    [beginPlaying, getAccessToken, locale],
  )

  // Start all timers. Called on first real text modification after `startGame`.
  const armTimers = useCallback(() => {
    const currentSettings = settingsRef.current
    const startedAt = Date.now()
    startedAtRef.current = startedAt
    lastInputAtRef.current = startedAt

    armIdleTimeout()

    if (currentSettings.globalTimerEnabled) {
      globalTimeoutRef.current = window.setTimeout(() => {
        endGame("global")
      }, currentSettings.globalTimerSeconds * 1000)
    }

    if (currentSettings.requiredWordIntervalEnabled) {
      armSpawnTimer()
    }

    uiTickRef.current = window.setInterval(() => {
      setNow(Date.now())
    }, UI_TICK_MS)

    setArmed(true)
  }, [armIdleTimeout, armSpawnTimer, endGame])

  // ---- Cleanup on unmount ------------------------------------------------
  useEffect(() => {
    return () => clearAllTimers()
  }, [clearAllTimers])

  // ---- Word-matching engine ---------------------------------------------
  // Strategy: only run when a required word is active AND the latest input
  // ended a word (i.e. a delimiter was just typed, or the textarea ends with
  // a delimiter). We then walk back from the cursor / end of text to extract
  // ONLY the word that just ended — this is O(word length), not O(text).
  const checkLatestWord = useCallback(
    (newText: string, caret: number) => {
      const required = currentWordRef.current
      if (!required) return

      // Position to look "behind". If the user just typed a delimiter at the
      // caret, the word ends at caret-1. Otherwise we look at the end of the
      // visible text (handles paste-with-delimiter cases).
      const lookAt = Math.min(caret, newText.length)
      // The character at lookAt-1 must be a delimiter for a word to have just
      // ended. Otherwise the user is still in the middle of typing.
      if (lookAt <= 0) return
      const lastChar = newText[lookAt - 1]
      if (!WORD_DELIMITERS.test(lastChar)) return

      // Walk back from lookAt-1 to find the start of the word.
      let end = lookAt - 1
      // Skip any consecutive delimiters (e.g. ", " typed in one go).
      while (end > 0 && WORD_DELIMITERS.test(newText[end - 1])) {
        end--
      }
      if (end === 0) return
      let start = end
      while (start > 0 && !WORD_DELIMITERS.test(newText[start - 1])) {
        start--
      }
      if (start === end) return

      const justFinished = newText.slice(start, end)
      if (!matchesWord(justFinished, required)) return

      // Match! Clear the active required word, record the match range,
      // disarm the "must use word" deadline, and (re)start the spawn timer
      // so the *next* word will appear `requiredWordIntervalSeconds` from now.
      setMatches((prev) => [...prev, { start, end }])
      setCurrentRequiredWord(null)
      currentWordRef.current = null
      wordSpawnedAtRef.current = null
      usedWordsRef.current.add(normalizeForMatch(required))
      if (wordUseTimeoutRef.current !== null) {
        window.clearTimeout(wordUseTimeoutRef.current)
        wordUseTimeoutRef.current = null
      }
      armSpawnTimer()
    },
    [armSpawnTimer],
  )

  // ---- Input handler -----------------------------------------------------
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value
      if (next === textRef.current) return

      // Post-session edit mode: free-form editing, no timers, no required-word
      // scanning. The player can correct typos until they hit "Start again".
      if (gameState === "ended") {
        setText(next)
        return
      }

      if (gameState !== "playing") return

      // First real text modification arms the timers. Same condition as the
      // visible-text mutation check above, so non-text keypresses (Ctrl, Alt,
      // arrow keys, etc.) don't kick the timers off.
      if (!armed) {
        armTimers()
      } else {
        // Any input — typing OR deletion — counts as activity per the spec.
        lastInputAtRef.current = Date.now()
        armIdleTimeout()
      }

      setText(next)

      // Only scan when there is an active required word.
      if (currentWordRef.current) {
        const caret = e.target.selectionStart ?? next.length
        checkLatestWord(next, caret)
      }
    },
    [armIdleTimeout, armTimers, armed, checkLatestWord, gameState],
  )

  // ---- Computed countdown values for HUD --------------------------------
  // While "playing" these tick along with the UI interval. While "ended" `now`
  // is frozen at game-over time so the bars stay where they were when the
  // session finished.
  const idleSecondsLeft = useMemo(() => {
    if ((gameState !== "playing" && gameState !== "ended") || !armed) {
      return settings.mainTimerSeconds
    }
    const elapsed = (now - lastInputAtRef.current) / 1000
    return Math.max(0, settings.mainTimerSeconds - elapsed)
  }, [armed, gameState, now, settings.mainTimerSeconds])

  const globalSecondsLeft = useMemo(() => {
    if (!settings.globalTimerEnabled) return null
    if ((gameState !== "playing" && gameState !== "ended") || !armed) {
      return settings.globalTimerSeconds
    }
    const elapsed = (now - startedAtRef.current) / 1000
    return Math.max(0, settings.globalTimerSeconds - elapsed)
  }, [armed, gameState, now, settings.globalTimerEnabled, settings.globalTimerSeconds])

  const useWordIn = useMemo(() => {
    if (!settings.requiredWordUseTimerEnabled) return null
    if (currentRequiredWord === null || wordSpawnedAtRef.current === null) return null
    const elapsed = (now - wordSpawnedAtRef.current) / 1000
    return Math.max(0, settings.requiredWordUseTimerSeconds - elapsed)
  }, [
    currentRequiredWord,
    now,
    settings.requiredWordUseTimerEnabled,
    settings.requiredWordUseTimerSeconds,
  ])

  // ---- Render ------------------------------------------------------------
  // Primary action button shown in the AppHeader varies by state. Settings ↔
  // game ↔ ended all use the same slot so the button stays anchored.
  let primaryAction: React.ReactNode = null
  if (gameState === "welcome" || gameState === "settings") {
    primaryAction = (
      <PrimaryActionButton
        icon={<Pencil className="size-4" aria-hidden />}
        label={t.settings.start}
        onClick={() => startGame(settings)}
      />
    )
  } else if (gameState === "playing") {
    primaryAction = (
      <PrimaryActionButton
        icon={<X className="size-4" aria-hidden />}
        label={t.game.quit}
        onClick={() => endGame("manual")}
      />
    )
  } else if (gameState === "ended") {
    primaryAction = (
      <PrimaryActionButton
        icon={<RotateCcw className="size-4" aria-hidden />}
        label={t.game.startAgain}
        onClick={startAgain}
      />
    )
  } else if (gameState === "viewing") {
    primaryAction = (
      <PrimaryActionButton
        icon={<X className="size-4" aria-hidden />}
        label={t.game.closeStory}
        onClick={closeStoryView}
      />
    )
  } else if (gameState === "profile") {
    primaryAction = (
      <PrimaryActionButton
        icon={<ArrowLeft className="size-4" aria-hidden />}
        label={t.game.goBack}
        onClick={goBackFromProfile}
      />
    )
  }

  return (
    <AppShell storiesRefreshKey={storiesRefreshKey} onStorySelect={viewStory}>
      <WelcomeModal
        open={gameState === "welcome" && authStatus !== "loading"}
        onContinue={dismissWelcome}
      />

      <ResultsModal
        open={gameState === "ended" && resultsModalOpen}
        result={result}
        onClose={closeResultsModal}
      />

      {gameState === "loading" ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-1 flex-col items-center justify-center gap-4"
        >
          <Loader2 className="text-primary size-10 animate-spin" aria-hidden />
          <span className="text-muted-foreground text-sm">
            {t.settings.categoryWordsLoading}
          </span>
        </div>
      ) : (
        <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 p-4 sm:p-6">
          <AppHeader action={primaryAction} onOpenProfile={openProfile} />

          {gameState === "welcome" || gameState === "settings" ? (
            <SettingsPanel settings={settings} onChange={handleSettingsChange} />
          ) : null}

          {gameState === "profile" ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ProfilePanel />
            </div>
          ) : null}

          {gameState === "viewing" ? (
            <>
              <p
                role="status"
                className="text-muted-foreground text-xs italic"
              >
                {t.game.viewingStory}
              </p>
              <div className="flex min-h-0 flex-1">
                <WritingArea
                  value={text}
                  onChange={() => {}}
                  matches={[]}
                  readOnly
                />
              </div>
            </>
          ) : null}

          {gameState === "playing" || gameState === "ended" ? (
            <>
              <GameHud
                idleSecondsLeft={idleSecondsLeft}
                idleSecondsTotal={settings.mainTimerSeconds}
                globalSecondsLeft={globalSecondsLeft}
                globalSecondsTotal={settings.globalTimerSeconds}
                requiredWordsEnabled={settings.requiredWordIntervalEnabled}
                requiredWord={currentRequiredWord}
                useWordIn={useWordIn !== null ? Math.ceil(useWordIn) : null}
                useWordTotal={
                  settings.requiredWordUseTimerEnabled
                    ? settings.requiredWordUseTimerSeconds
                    : null
                }
              />

              {/* Writing area takes the entire remaining space. */}
              <div className="flex min-h-0 flex-1">
                <WritingArea
                  ref={textareaRef}
                  value={text}
                  onChange={handleChange}
                  matches={matches}
                />
              </div>
            </>
          ) : null}
        </main>
      )}
    </AppShell>
  )
}
