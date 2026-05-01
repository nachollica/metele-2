"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"

import { GameHud } from "./game-hud"
import { ResultsModal } from "./results-modal"
import { SettingsModal } from "./settings-modal"
import { WritingArea } from "./writing-area"

import { pickRequiredWord, matchesWord, normalizeForMatch } from "@/lib/metele/words"
import { useLocale } from "@/lib/i18n"
import { playBell, primeAudio } from "@/lib/metele/sound"
import { randomIntervalMs } from "@/lib/metele/random"
import {
  DEFAULT_SETTINGS,
  type EndReason,
  type GameResult,
  type GameSettings,
  type MatchedRange,
} from "@/lib/metele/types"

type GameState = "settings" | "playing" | "ended"

// Word delimiter characters: when one of these is the most recent character,
// the word that just ended is finalized and (if a required word is active)
// compared to it.
const WORD_DELIMITERS = /[\s.,;:!?'"()\[\]{}\-—–…/\\]/

// Tick interval for UI countdowns. We use a single 100ms interval for all
// cosmetic countdowns, while game-ending events use independent timeouts so
// they remain accurate even if the tab is throttled.
const UI_TICK_MS = 100

export function MeteleGame() {
  // ---- High-level game state ---------------------------------------------
  const [gameState, setGameState] = useState<GameState>("settings")
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [result, setResult] = useState<GameResult | null>(null)

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

  // Independent timers for game-ending events.
  const idleTimeoutRef = useRef<number | null>(null)
  const globalTimeoutRef = useRef<number | null>(null)
  // The "spawn next required word" timer. Only runs when there is NO active
  // required word; it is canceled on spawn and re-armed when the word is
  // consumed by the player.
  const wordSpawnTimeoutRef = useRef<number | null>(null)
  const wordUseTimeoutRef = useRef<number | null>(null)
  const uiTickRef = useRef<number | null>(null)

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
      const durationMs = Date.now() - startedAtRef.current
      const trimmed = finalText.trim()
      const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length

      clearAllTimers()
      setGameState("ended")
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

  // ---- Required word lifecycle ------------------------------------------
  // Spawning ONLY happens via this function. It selects a new word, arms the
  // "use it in time" deadline, and intentionally does NOT schedule the next
  // spawn — that is the responsibility of `armSpawnTimer`, which is invoked
  // when the active word is consumed by the player.
  const locale = useLocale()

  const spawnRequiredWord = useCallback(() => {
    const currentSettings = settingsRef.current
    const next = pickRequiredWord(locale, usedWordsRef.current)
    setCurrentRequiredWord(next)
    // Mirror into the ref synchronously so input handlers running before
    // the next render still see the active word.
    currentWordRef.current = next
    wordSpawnedAtRef.current = Date.now()

    if (currentSettings.bellEnabled) {
      playBell()
    }

    // (Re)arm the "must use word in time" timer if enabled.
    if (wordUseTimeoutRef.current !== null) {
      window.clearTimeout(wordUseTimeoutRef.current)
      wordUseTimeoutRef.current = null
    }
    if (currentSettings.requiredWordUseTimerEnabled) {
      wordUseTimeoutRef.current = window.setTimeout(() => {
        // If the word is still active when this fires, the player ran out.
        if (currentWordRef.current !== null) {
          endGame("unused-word")
        }
      }, currentSettings.requiredWordUseTimerSeconds * 1000)
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
  const startGame = useCallback(
    (newSettings: GameSettings) => {
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

      const startedAt = Date.now()
      startedAtRef.current = startedAt
      lastInputAtRef.current = startedAt
      wordSpawnedAtRef.current = null

      clearAllTimers()
      setGameState("playing")

      // Warm up the audio context inside the user gesture from the Start
      // button so the first bell can play even on strict mobile browsers.
      if (newSettings.bellEnabled) {
        primeAudio()
      }

      // Idle timer starts immediately — the player must begin typing.
      armIdleTimeout()

      // Global timer.
      if (newSettings.globalTimerEnabled) {
        globalTimeoutRef.current = window.setTimeout(() => {
          endGame("global")
        }, newSettings.globalTimerSeconds * 1000)
      }

      // Schedule the first required word using the spawn-interval helper
      // (which respects the "no word active" guard, but at start there isn't
      // one so it will fire normally).
      armSpawnTimer()

      // UI tick to refresh countdown displays.
      uiTickRef.current = window.setInterval(() => {
        setNow(Date.now())
      }, UI_TICK_MS)

      // Focus the textarea so the player can type immediately.
      window.setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [armIdleTimeout, armSpawnTimer, clearAllTimers, endGame],
  )

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
      if (gameState !== "playing") return
      const next = e.target.value

      // Any input — typing OR deletion — counts as activity per the spec.
      lastInputAtRef.current = Date.now()
      armIdleTimeout()

      setText(next)

      // Only scan when there is an active required word.
      if (currentWordRef.current) {
        const caret = e.target.selectionStart ?? next.length
        checkLatestWord(next, caret)
      }
    },
    [armIdleTimeout, checkLatestWord, gameState],
  )

  // ---- Computed countdown values for HUD --------------------------------
  const idleSecondsLeft = useMemo(() => {
    if (gameState !== "playing") return settings.mainTimerSeconds
    const elapsed = (now - lastInputAtRef.current) / 1000
    return Math.max(0, settings.mainTimerSeconds - elapsed)
  }, [gameState, now, settings.mainTimerSeconds])

  const globalSecondsLeft = useMemo(() => {
    if (!settings.globalTimerEnabled) return null
    if (gameState !== "playing") return settings.globalTimerSeconds
    const elapsed = (now - startedAtRef.current) / 1000
    return Math.max(0, settings.globalTimerSeconds - elapsed)
  }, [gameState, now, settings.globalTimerEnabled, settings.globalTimerSeconds])

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
  return (
    <div className="bg-background text-foreground min-h-dvh">
      <SettingsModal open={gameState === "settings"} initial={settings} onStart={startGame} />

      <ResultsModal
        open={gameState === "ended"}
        result={result}
        onPlayAgain={() => setGameState("settings")}
      />

      {gameState !== "settings" ? (
        <main className="mx-auto flex h-dvh max-w-5xl flex-col gap-4 p-4 sm:p-6">
          <GameHud
            idleSecondsLeft={idleSecondsLeft}
            idleSecondsTotal={settings.mainTimerSeconds}
            globalSecondsLeft={globalSecondsLeft}
            globalSecondsTotal={settings.globalTimerSeconds}
            characters={text.length}
            onGiveUp={() => endGame("manual")}
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
              disabled={gameState !== "playing"}
              onAppendOnly={() => {
                // User attempted a non-append operation; no action needed,
                // but we could log or trigger a visual feedback here.
              }}
            />
          </div>
        </main>
      ) : null}
    </div>
  )
}
