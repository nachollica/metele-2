"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"

import { useAuth } from "@/lib/auth"
import { useLocale } from "@/lib/i18n"
import { usePreferences } from "@/lib/preferences"
import { clearInspiration } from "@/lib/flowfic/inspiration"
import { playBell, primeAudio, speakWord } from "@/lib/flowfic/sound"
import { randomIntervalMs } from "@/lib/flowfic/random"
import { pickRequiredWord, normalizeForMatch } from "@/lib/flowfic/words"
import {
  isInflectionMatch,
  loadMatchMap,
  type MatchMap,
} from "@/lib/flowfic/match-map"
import {
  fetchRandomWords,
  fetchRelatedWords,
  parseCategoriesInput,
} from "@/lib/flowfic/words-api"
import { createStory, type CreateStoryInput } from "@/lib/flowfic/stories-api"
import {
  DEFAULT_SETTINGS,
  type EndReason,
  type GameResult,
  type GameSettings,
  type MatchedRange,
} from "@/lib/flowfic/types"

/**
 * Session lifecycle, independent of app navigation:
 *   idle    → no session; the dashboard shows sections.
 *   loading → resolving the custom word pool before the first keystroke.
 *   playing → timers armed on first input; required words spawn.
 *   paused  → timers frozen mid-sprint; the editor is read-only until resumed.
 *   ended   → stats captured; the text stays editable until the user leaves.
 */
export type GameState = "idle" | "loading" | "playing" | "paused" | "ended"

// Max time we'll block on the categories backend call before starting with the
// hardcoded fallback pool (the request, if it ever resolves, is discarded).
const CATEGORIES_FETCH_TIMEOUT_MS = 2500

// Word delimiters: when one is the most recent character, the word that just
// ended is finalized and (if a required word is active) compared to it.
const WORD_DELIMITERS = /[\s.,;:!?'"()[\]{}\-—–…/\\]/

// Single cosmetic-countdown tick. Game-ending events use independent timeouts
// so they stay accurate even if the tab is throttled.
const UI_TICK_MS = 100

// When the "use word in N seconds" deadline is disabled, required words still
// disappear automatically after this many seconds. No game-over is triggered.
const WORD_AUTO_DISMISS_MS = 10_000

/**
 * The Flowfic writing engine as a hook. Ported verbatim from the original
 * single-screen game component; the only change is that it no longer renders
 * chrome or owns navigation — it exposes state + actions the dashboard wires
 * into whichever screen is active.
 */
export function useGameEngine() {
  const locale = useLocale()
  const { getAccessToken, status: authStatus } = useAuth()
  const {
    soundEnabled: soundPref,
    setSoundEnabled: setSoundPref,
    soundMode: soundModePref,
    setSoundMode: setSoundModePref,
  } = usePreferences()

  const [gameState, setGameState] = useState<GameState>("idle")
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [result, setResult] = useState<GameResult | null>(null)
  const [resultsModalOpen, setResultsModalOpen] = useState(false)
  const [armed, setArmed] = useState(false)
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0)
  const [failedSave, setFailedSave] = useState<CreateStoryInput | null>(null)
  const [retryingSave, setRetryingSave] = useState(false)
  const unsavedStoryRef = useRef(false)

  // ---- Live game data ----------------------------------------------------
  const [text, setText] = useState("")
  const [matches, setMatches] = useState<MatchedRange[]>([])
  const [currentRequiredWord, setCurrentRequiredWord] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // ---- Refs (no re-render needed) ----------------------------------------
  const textRef = useRef("")
  const usedWordsRef = useRef<Set<string>>(new Set())
  const startedAtRef = useRef<number>(0)
  const lastInputAtRef = useRef<number>(0)
  const wordSpawnedAtRef = useRef<number | null>(null)
  const currentWordRef = useRef<string | null>(null)
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS)
  const customPoolRef = useRef<readonly string[] | null>(null)
  // Required-word match map for the active locale (null until loaded / offline).
  const matchMapRef = useRef<MatchMap | null>(null)

  const idleTimeoutRef = useRef<number | null>(null)
  const globalTimeoutRef = useRef<number | null>(null)
  const wordSpawnTimeoutRef = useRef<number | null>(null)
  const wordUseTimeoutRef = useRef<number | null>(null)
  const uiTickRef = useRef<number | null>(null)
  const armSpawnTimerRef = useRef<() => void>(() => {})

  // Wall-clock deadline (ms epoch) for each running timeout, so pausing can
  // convert "fires at T" into "fires in N ms" and re-arm on resume. `null`
  // means that timer is not currently running.
  const deadlinesRef = useRef<{
    idle: number | null
    global: number | null
    wordSpawn: number | null
    wordUse: number | null
  }>({ idle: null, global: null, wordSpawn: null, wordUse: null })
  // Remaining ms captured at the moment of pausing; consumed by resume().
  const pausedRemainingRef = useRef<{
    idle: number | null
    global: number | null
    wordSpawn: number | null
    wordUse: number | null
  } | null>(null)
  // What the word-use timeout does when it fires (see spawnRequiredWord): end
  // the sprint, or silently retire the unanswered word. Re-armed on resume.
  const wordUseActionRef = useRef<"end" | "dismiss">("end")
  // When the current pause started, so resume can shift the elapsed-time marks
  // the HUD countdowns are derived from.
  const pausedAtRef = useRef<number | null>(null)
  // Latest game state, readable from callbacks without re-creating them.
  const gameStateRef = useRef<GameState>("idle")

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    textRef.current = text
  }, [text])
  useEffect(() => {
    currentWordRef.current = currentRequiredWord
  }, [currentRequiredWord])
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  // Prefetch the required-word match map for the active locale so it is warm
  // before a game starts. It is versioned/immutable, so this is effectively a
  // one-time fetch per browser; startGame also awaits it before playing.
  useEffect(() => {
    let active = true
    void loadMatchMap(locale).then((map) => {
      if (active) matchMapRef.current = map
    })
    return () => {
      active = false
    }
  }, [locale])

  // Sound prefs hydrate from localStorage; mirror them into the active
  // settings. Enabled + mode are independent keys (with a legacy boolean
  // `bellEnabled` migrated in the preferences layer).
  useEffect(() => {
    if (soundPref === null) return
    setSettings((s) => (s.soundEnabled === soundPref ? s : { ...s, soundEnabled: soundPref }))
    settingsRef.current = { ...settingsRef.current, soundEnabled: soundPref }
  }, [soundPref])
  useEffect(() => {
    if (soundModePref === null) return
    setSettings((s) => (s.soundMode === soundModePref ? s : { ...s, soundMode: soundModePref }))
    settingsRef.current = { ...settingsRef.current, soundMode: soundModePref }
  }, [soundModePref])

  const handleSettingsChange = useCallback(
    (next: GameSettings) => {
      setSettings(next)
      if (next.soundEnabled !== soundPref) setSoundPref(next.soundEnabled)
      if (next.soundMode !== soundModePref) setSoundModePref(next.soundMode)
    },
    [soundPref, setSoundPref, soundModePref, setSoundModePref],
  )

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
    deadlinesRef.current = { idle: null, global: null, wordSpawn: null, wordUse: null }
    pausedRemainingRef.current = null
  }, [])

  // Start the cosmetic 100ms tick that drives the HUD countdowns. Idempotent —
  // both arming and resuming call it.
  const startUiTick = useCallback(() => {
    if (uiTickRef.current !== null) return
    uiTickRef.current = window.setInterval(() => {
      setNow(Date.now())
    }, UI_TICK_MS)
  }, [])

  const endGame = useCallback(
    (reason: EndReason) => {
      // Manual quit before timers ever started: nothing to score, back to idle.
      if (reason === "manual" && !armed) {
        clearAllTimers()
        setArmed(false)
        setText("")
        textRef.current = ""
        setMatches([])
        setCurrentRequiredWord(null)
        currentWordRef.current = null
        setResult(null)
        setGameState("idle")
        return
      }

      const finalText = textRef.current
      const durationMs = startedAtRef.current === 0 ? 0 : Date.now() - startedAtRef.current
      const trimmed = finalText.trim()
      const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length

      clearAllTimers()
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
      unsavedStoryRef.current = trimmed.length > 0
    },
    [armed, clearAllTimers],
  )

  const closeResultsModal = useCallback(() => {
    setResultsModalOpen(false)
  }, [])

  const persistStory = useCallback(
    async (payload: CreateStoryInput): Promise<boolean> => {
      const token = await getAccessToken()
      if (token === null) return false
      const created = await createStory(token, payload)
      return created !== null
    },
    [getAccessToken],
  )

  const saveCurrentStoryIfNeeded = useCallback(() => {
    if (!unsavedStoryRef.current) return
    unsavedStoryRef.current = false
    const snapshot = result
    const finalText = textRef.current
    if (snapshot === null || finalText.trim().length === 0) return
    const payload: CreateStoryInput = {
      text: finalText,
      lang: locale,
      settings: settingsRef.current,
      stats: {
        reason: snapshot.reason,
        durationMs: snapshot.durationMs,
        characters: snapshot.characters,
        words: snapshot.words,
        requiredWordsUsed: snapshot.requiredWordsUsed,
      },
    }
    void persistStory(payload).then((ok) => {
      if (ok) {
        setStoriesRefreshKey((k) => k + 1)
      } else {
        setFailedSave(payload)
      }
    })
  }, [persistStory, locale, result])

  const retryFailedSave = useCallback(() => {
    if (failedSave === null) return
    setRetryingSave(true)
    void persistStory(failedSave).then((ok) => {
      setRetryingSave(false)
      if (ok) {
        setFailedSave(null)
        setStoriesRefreshKey((k) => k + 1)
      }
    })
  }, [failedSave, persistStory])

  const dismissFailedSave = useCallback(() => setFailedSave(null), [])

  const resetSession = useCallback(() => {
    clearAllTimers()
    setText("")
    textRef.current = ""
    setMatches([])
    setCurrentRequiredWord(null)
    currentWordRef.current = null
    setResult(null)
    setResultsModalOpen(false)
    setArmed(false)
    wordSpawnedAtRef.current = null
    usedWordsRef.current = new Set()
    setGameState("idle")
  }, [clearAllTimers])

  // Save any just-finished story, wipe transient state, return to idle. The
  // dashboard decides where to navigate afterward. This is the final checkout
  // of the game flow, so it also drops the inspiration the sprint was written
  // against — the next story starts from a blank invitation.
  const finishAndReset = useCallback(() => {
    saveCurrentStoryIfNeeded()
    resetSession()
    clearInspiration()
  }, [resetSession, saveCurrentStoryIfNeeded])

  // ---- Required word lifecycle ------------------------------------------
  // Each arm-* helper takes an explicit duration and records the wall-clock
  // deadline, so pause() can turn "fires at T" back into "fires in N ms" and
  // resume() can re-arm the remainder without re-deriving it from settings.
  const armWordUseTimeout = useCallback(
    (ms: number) => {
      if (wordUseTimeoutRef.current !== null) {
        window.clearTimeout(wordUseTimeoutRef.current)
      }
      deadlinesRef.current.wordUse = Date.now() + ms
      wordUseTimeoutRef.current = window.setTimeout(() => {
        wordUseTimeoutRef.current = null
        deadlinesRef.current.wordUse = null
        if (currentWordRef.current === null) return
        // Deadline enforced: an unanswered word ends the sprint. Otherwise the
        // word just retires and the next spawn is scheduled.
        if (wordUseActionRef.current === "end") {
          endGame("unused-word")
          return
        }
        setCurrentRequiredWord(null)
        currentWordRef.current = null
        wordSpawnedAtRef.current = null
        armSpawnTimerRef.current()
      }, ms)
    },
    [endGame],
  )

  const spawnRequiredWordRef = useRef<() => void>(() => {})
  const armSpawnTimeout = useCallback((ms: number) => {
    if (wordSpawnTimeoutRef.current !== null) {
      window.clearTimeout(wordSpawnTimeoutRef.current)
    }
    deadlinesRef.current.wordSpawn = Date.now() + ms
    wordSpawnTimeoutRef.current = window.setTimeout(() => {
      wordSpawnTimeoutRef.current = null
      deadlinesRef.current.wordSpawn = null
      spawnRequiredWordRef.current()
    }, ms)
  }, [])

  const spawnRequiredWord = useCallback(() => {
    const currentSettings = settingsRef.current
    const next = pickRequiredWord(
      locale,
      usedWordsRef.current,
      customPoolRef.current ?? undefined,
    )
    setCurrentRequiredWord(next)
    currentWordRef.current = next
    wordSpawnedAtRef.current = Date.now()

    if (currentSettings.soundEnabled && next !== null) {
      if (currentSettings.soundMode === "speak") {
        speakWord(next, locale)
      } else {
        playBell()
      }
    }

    const action = currentSettings.requiredWordUseTimerEnabled ? "end" : "dismiss"
    wordUseActionRef.current = action
    armWordUseTimeout(
      action === "end"
        ? currentSettings.requiredWordUseTimerSeconds * 1000
        : WORD_AUTO_DISMISS_MS,
    )
  }, [armWordUseTimeout, locale])

  const armSpawnTimer = useCallback(() => {
    if (currentWordRef.current !== null) {
      if (wordSpawnTimeoutRef.current !== null) {
        window.clearTimeout(wordSpawnTimeoutRef.current)
        wordSpawnTimeoutRef.current = null
        deadlinesRef.current.wordSpawn = null
      }
      return
    }
    armSpawnTimeout(randomIntervalMs(settingsRef.current.requiredWordIntervalSeconds))
  }, [armSpawnTimeout])

  useEffect(() => {
    armSpawnTimerRef.current = armSpawnTimer
  }, [armSpawnTimer])
  useEffect(() => {
    spawnRequiredWordRef.current = spawnRequiredWord
  }, [spawnRequiredWord])

  // ---- Idle timeout ------------------------------------------------------
  // No-op when the idle timeout is switched off: the player can then think for
  // as long as they like and only the session timer (or a missed required
  // word) can end the sprint.
  const armIdleTimeoutFor = useCallback(
    (ms: number) => {
      if (idleTimeoutRef.current !== null) {
        window.clearTimeout(idleTimeoutRef.current)
        idleTimeoutRef.current = null
      }
      if (!settingsRef.current.idleTimerEnabled) {
        deadlinesRef.current.idle = null
        return
      }
      deadlinesRef.current.idle = Date.now() + ms
      idleTimeoutRef.current = window.setTimeout(() => {
        idleTimeoutRef.current = null
        deadlinesRef.current.idle = null
        endGame("idle")
      }, ms)
    },
    [endGame],
  )

  const armIdleTimeout = useCallback(() => {
    armIdleTimeoutFor(settingsRef.current.mainTimerSeconds * 1000)
  }, [armIdleTimeoutFor])

  // ---- Start / restart ---------------------------------------------------
  const beginPlaying = useCallback(
    (newSettings: GameSettings, pool: readonly string[] | null) => {
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

      startedAtRef.current = 0
      lastInputAtRef.current = 0
      wordSpawnedAtRef.current = null

      clearAllTimers()
      setArmed(false)
      setGameState("playing")

      // Only the bell uses the Web Audio context; "speak" mode drives
      // SpeechSynthesis, which needs no priming here.
      if (newSettings.soundEnabled && newSettings.soundMode === "bell") {
        primeAudio()
      }

      window.setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [clearAllTimers],
  )

  const startGame = useCallback(
    (newSettings: GameSettings) => {
      if (!newSettings.requiredWordIntervalEnabled) {
        beginPlaying(newSettings, null)
        return
      }

      setGameState("loading")

      // "Story world" always plays from the built-in fallback pool (the
      // author-driven backend integration is future work); the seed input is
      // ignored. We still await the match map so client-side matching is ready.
      if (newSettings.wordSource === "universe") {
        void loadMatchMap(locale).then((map) => {
          matchMapRef.current = map
          beginPlaying(newSettings, null)
        })
        return
      }

      // "Free words": seeds → related pool, empty input → random pool.
      const seeds = parseCategoriesInput(newSettings.wordSourceSeeds)

      let resolved = false
      const timeout = new Promise<null>((resolve) =>
        window.setTimeout(() => resolve(null), CATEGORIES_FETCH_TIMEOUT_MS),
      )
      const fetchPool = (async (): Promise<string[] | null> => {
        const token = await getAccessToken()
        if (token === null) return null
        return seeds.length > 0
          ? fetchRelatedWords(token, seeds, locale)
          : fetchRandomWords(token, locale)
      })()
      // Wait for both the word pool (time-boxed) and the match map before
      // playing, so the spinner covers matching being ready too.
      void Promise.all([
        Promise.race([fetchPool, timeout]),
        loadMatchMap(locale),
      ]).then(([pool, map]) => {
        if (resolved) return
        resolved = true
        matchMapRef.current = map
        beginPlaying(newSettings, pool)
      })
    },
    [beginPlaying, getAccessToken, locale],
  )

  // The session timer is unconditional — its length is picked from the home
  // dial and there is no "off" any more.
  const armGlobalTimeout = useCallback(
    (ms: number) => {
      if (globalTimeoutRef.current !== null) {
        window.clearTimeout(globalTimeoutRef.current)
      }
      deadlinesRef.current.global = Date.now() + ms
      globalTimeoutRef.current = window.setTimeout(() => {
        globalTimeoutRef.current = null
        deadlinesRef.current.global = null
        endGame("global")
      }, ms)
    },
    [endGame],
  )

  const armTimers = useCallback(() => {
    const currentSettings = settingsRef.current
    const startedAt = Date.now()
    startedAtRef.current = startedAt
    lastInputAtRef.current = startedAt

    armIdleTimeout()
    armGlobalTimeout(currentSettings.globalTimerSeconds * 1000)

    if (currentSettings.requiredWordIntervalEnabled) {
      armSpawnTimer()
    }

    startUiTick()
    setArmed(true)
  }, [armGlobalTimeout, armIdleTimeout, armSpawnTimer, startUiTick])

  // ---- Pause / resume ----------------------------------------------------
  // Freeze the sprint: cancel every pending timeout, remembering how long each
  // had left. Also stops the UI tick so the HUD holds its numbers. Pausing
  // before the first keystroke (not yet `armed`) is still a valid state change
  // — there is simply nothing to remember.
  const pause = useCallback(() => {
    if (gameStateRef.current !== "playing") return
    const nowMs = Date.now()
    const remainingFor = (deadline: number | null) =>
      deadline === null ? null : Math.max(0, deadline - nowMs)
    const d = deadlinesRef.current
    const remaining = {
      idle: remainingFor(d.idle),
      global: remainingFor(d.global),
      wordSpawn: remainingFor(d.wordSpawn),
      wordUse: remainingFor(d.wordUse),
    }
    // clearAllTimers resets the deadline/remainder scratch space, so stash the
    // captured remainders after it runs, not before.
    clearAllTimers()
    pausedRemainingRef.current = remaining
    pausedAtRef.current = nowMs
    setGameState("paused")
    setNow(nowMs)
  }, [clearAllTimers])

  // Unfreeze: re-arm each timer with the time it had left, and shift the
  // "started at" / "last input at" / "word spawned at" marks forward by the
  // paused duration so the HUD's elapsed-based countdowns stay in step with
  // the re-armed timeouts. Focus returns to the editor with the caret at the
  // end of the story, so the player just keeps typing.
  const resume = useCallback(() => {
    if (gameStateRef.current !== "paused") return
    const remaining = pausedRemainingRef.current
    const pausedMs = pausedAtRef.current === null ? 0 : Date.now() - pausedAtRef.current
    pausedAtRef.current = null
    pausedRemainingRef.current = null

    if (startedAtRef.current !== 0) startedAtRef.current += pausedMs
    if (lastInputAtRef.current !== 0) lastInputAtRef.current += pausedMs
    if (wordSpawnedAtRef.current !== null) wordSpawnedAtRef.current += pausedMs

    setGameState("playing")

    if (remaining !== null) {
      if (remaining.idle !== null) armIdleTimeoutFor(remaining.idle)
      if (remaining.global !== null) armGlobalTimeout(remaining.global)
      if (remaining.wordSpawn !== null) armSpawnTimeout(remaining.wordSpawn)
      if (remaining.wordUse !== null) armWordUseTimeout(remaining.wordUse)
    }
    if (armed) startUiTick()
    setNow(Date.now())

    window.setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const end = el.value.length
      el.setSelectionRange(end, end)
    }, 0)
  }, [
    armGlobalTimeout,
    armIdleTimeoutFor,
    armSpawnTimeout,
    armWordUseTimeout,
    armed,
    startUiTick,
  ])

  // ---- Logout cleanup: authenticated → anonymous wipes the session -------
  const prevAuthStatusRef = useRef(authStatus)
  useEffect(() => {
    const prev = prevAuthStatusRef.current
    prevAuthStatusRef.current = authStatus
    if (prev === "authenticated" && authStatus === "anonymous") {
      unsavedStoryRef.current = false
      resetSession()
    }
  }, [authStatus, resetSession])

  useEffect(() => {
    return () => clearAllTimers()
  }, [clearAllTimers])

  // ---- Word-matching engine ---------------------------------------------
  const checkLatestWord = useCallback(
    (newText: string, caret: number) => {
      const required = currentWordRef.current
      if (!required) return

      const lookAt = Math.min(caret, newText.length)
      if (lookAt <= 0) return
      const lastChar = newText[lookAt - 1]
      if (!WORD_DELIMITERS.test(lastChar)) return

      let end = lookAt - 1
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
      if (!isInflectionMatch(justFinished, required, locale, matchMapRef.current)) return

      setMatches((prev) => [...prev, { start, end }])
      setCurrentRequiredWord(null)
      currentWordRef.current = null
      wordSpawnedAtRef.current = null
      usedWordsRef.current.add(normalizeForMatch(required))
      if (wordUseTimeoutRef.current !== null) {
        window.clearTimeout(wordUseTimeoutRef.current)
        wordUseTimeoutRef.current = null
        deadlinesRef.current.wordUse = null
      }
      armSpawnTimer()
    },
    [armSpawnTimer, locale],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value
      if (next === textRef.current) return

      if (gameState === "ended") {
        setText(next)
        return
      }

      if (gameState !== "playing") return

      if (!armed) {
        armTimers()
      } else {
        lastInputAtRef.current = Date.now()
        armIdleTimeout()
      }

      setText(next)

      if (currentWordRef.current) {
        const caret = e.target.selectionStart ?? next.length
        checkLatestWord(next, caret)
      }
    },
    [armIdleTimeout, armTimers, armed, checkLatestWord, gameState],
  )

  // ---- Computed countdown values for the HUD ----------------------------
  // A live sprint is any state where a countdown is meaningful. `paused` is
  // included so the bars keep their frozen values instead of snapping back to
  // full while the game is held.
  const inSession =
    gameState === "playing" || gameState === "paused" || gameState === "ended"

  const idleSecondsLeft = useMemo(() => {
    if (!settings.idleTimerEnabled) return null
    if (!inSession || !armed) return settings.mainTimerSeconds
    const elapsed = (now - lastInputAtRef.current) / 1000
    return Math.max(0, settings.mainTimerSeconds - elapsed)
  }, [armed, inSession, now, settings.idleTimerEnabled, settings.mainTimerSeconds])

  const globalSecondsLeft = useMemo(() => {
    if (!inSession || !armed) return settings.globalTimerSeconds
    const elapsed = (now - startedAtRef.current) / 1000
    return Math.max(0, settings.globalTimerSeconds - elapsed)
  }, [armed, inSession, now, settings.globalTimerSeconds])

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

  return {
    // state
    gameState,
    settings,
    text,
    matches,
    currentRequiredWord,
    result,
    resultsModalOpen,
    armed,
    failedSave,
    retryingSave,
    storiesRefreshKey,
    textareaRef,
    // derived
    isPlaying: gameState === "playing",
    isPaused: gameState === "paused",
    sessionActive: gameState !== "idle",
    idleSecondsLeft,
    globalSecondsLeft,
    useWordIn,
    // actions
    setSettings: handleSettingsChange,
    startGame,
    pause,
    resume,
    quit: () => endGame("manual"),
    handleChange,
    closeResultsModal,
    saveCurrentStoryIfNeeded,
    resetSession,
    finishAndReset,
    retryFailedSave,
    dismissFailedSave,
  }
}

export type GameEngine = ReturnType<typeof useGameEngine>
