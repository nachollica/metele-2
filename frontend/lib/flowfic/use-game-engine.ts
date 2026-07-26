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
import { playBell, primeAudio } from "@/lib/flowfic/sound"
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
 *   ended   → stats captured; the text stays editable until the user leaves.
 */
export type GameState = "idle" | "loading" | "playing" | "ended"

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
const WORD_AUTO_DISMISS_MS = 7_000

/**
 * The FLOWFIC writing engine as a hook. Ported verbatim from the original
 * single-screen game component; the only change is that it no longer renders
 * chrome or owns navigation — it exposes state + actions the dashboard wires
 * into whichever screen is active.
 */
export function useGameEngine() {
  const locale = useLocale()
  const { getAccessToken, status: authStatus } = useAuth()
  const { bellEnabled: bellPref, setBellEnabled: setBellPref } = usePreferences()

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

  // Bell pref hydrates from localStorage; mirror it into the active settings.
  useEffect(() => {
    if (bellPref === null) return
    setSettings((s) => (s.bellEnabled === bellPref ? s : { ...s, bellEnabled: bellPref }))
    settingsRef.current = { ...settingsRef.current, bellEnabled: bellPref }
  }, [bellPref])

  const handleSettingsChange = useCallback(
    (next: GameSettings) => {
      setSettings(next)
      if (next.bellEnabled !== bellPref) setBellPref(next.bellEnabled)
    },
    [bellPref, setBellPref],
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
  // dashboard decides where to navigate afterward.
  const finishAndReset = useCallback(() => {
    saveCurrentStoryIfNeeded()
    resetSession()
  }, [resetSession, saveCurrentStoryIfNeeded])

  // ---- Required word lifecycle ------------------------------------------
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

    if (currentSettings.bellEnabled) {
      playBell()
    }

    if (wordUseTimeoutRef.current !== null) {
      window.clearTimeout(wordUseTimeoutRef.current)
      wordUseTimeoutRef.current = null
    }
    if (currentSettings.requiredWordUseTimerEnabled) {
      wordUseTimeoutRef.current = window.setTimeout(() => {
        if (currentWordRef.current !== null) {
          endGame("unused-word")
        }
      }, currentSettings.requiredWordUseTimerSeconds * 1000)
    } else {
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

  const armSpawnTimer = useCallback(() => {
    if (wordSpawnTimeoutRef.current !== null) {
      window.clearTimeout(wordSpawnTimeoutRef.current)
      wordSpawnTimeoutRef.current = null
    }
    if (currentWordRef.current !== null) return
    const intervalMs = randomIntervalMs(settingsRef.current.requiredWordIntervalSeconds)
    wordSpawnTimeoutRef.current = window.setTimeout(() => {
      wordSpawnTimeoutRef.current = null
      spawnRequiredWord()
    }, intervalMs)
  }, [spawnRequiredWord])

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

      if (newSettings.bellEnabled) {
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

      const seeds = newSettings.categoryWordsEnabled
        ? parseCategoriesInput(newSettings.categoryWordsInput)
        : []

      setGameState("loading")

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
    sessionActive: gameState !== "idle",
    idleSecondsLeft,
    globalSecondsLeft,
    useWordIn,
    // actions
    setSettings: handleSettingsChange,
    startGame,
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
