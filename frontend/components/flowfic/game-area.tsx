"use client"

// The writing column while a sprint is loading, running, or in its editable
// epilogue. Split out of `dashboard.tsx`, which holds the app shell: the shell
// decides WHICH of the two layouts is up, this decides what fills the game one.

import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslations } from "@/lib/i18n"
import { deriveTitle } from "@/lib/flowfic/gamification"
import { useGameEngine } from "@/lib/flowfic/use-game-engine"
import { FIELD_LABEL, HINT } from "@/lib/text-styles"

import { Spinner } from "./dashboard-widgets"
import { GameHud } from "./game-hud"
import { WritingArea } from "./writing-area"

// ---- Game area (left column while loading/playing/ended) -----------------

export function LoadingSplash() {
  const t = useTranslations()
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-4">
      <Spinner size="page" />
      <span className={HINT}>{t.settings.loadingWords}</span>
    </div>
  )
}

export function GameArea({
  engine,
  onQuit,
  onFinish,
}: {
  engine: ReturnType<typeof useGameEngine>
  onQuit: () => void
  onFinish: () => void
}) {
  const t = useTranslations()
  return (
    <>
      {engine.failedSave !== null ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3 text-sm"
        >
          <AlertTriangle className="text-destructive size-4 shrink-0" aria-hidden />
          <span className="text-destructive flex-1">{t.game.saveFailed}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={engine.retryFailedSave}
              disabled={engine.retryingSave}
            >
              {engine.retryingSave ? t.game.saveRetrying : t.game.saveRetry}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={engine.dismissFailedSave}
              disabled={engine.retryingSave}
            >
              {t.game.saveDismiss}
            </Button>
          </div>
        </div>
      ) : null}

      <GameHud
        idleSecondsLeft={engine.idleSecondsLeft}
        idleSecondsTotal={engine.settings.mainTimerSeconds}
        globalSecondsLeft={engine.globalSecondsLeft}
        globalSecondsTotal={engine.settings.globalTimerSeconds}
        requiredWordsEnabled={engine.settings.requiredWordIntervalEnabled}
        requiredWord={engine.currentRequiredWord}
        useWordIn={engine.useWordIn !== null ? Math.ceil(engine.useWordIn) : null}
        useWordTotal={
          engine.settings.requiredWordUseTimerEnabled ? engine.settings.requiredWordUseTimerSeconds : null
        }
        paused={engine.isPaused}
        ended={engine.gameState === "ended"}
        onPause={engine.pause}
        onResume={engine.resume}
        onQuit={onQuit}
        onFinish={onFinish}
      />
      {/* Ended: the story is finished but still editable, so this is where it
          gets named. Sits between the HUD and the text, pushing the editor down
          — a shift the player never sees mid-flow, since the results modal is
          over it when the state changes. */}
      {engine.gameState === "ended" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="story-title" className={FIELD_LABEL}>
            {t.game.titleLabel}
          </Label>
          <Input
            id="story-title"
            type="text"
            value={engine.storyTitle}
            onChange={(e) => engine.setStoryTitle(e.target.value)}
            maxLength={200}
            placeholder={deriveTitle(engine.text, t.dashboard.untitledStory)}
            className="text-base"
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <WritingArea
          ref={engine.textareaRef}
          value={engine.text}
          onChange={engine.handleChange}
          matches={engine.matches}
          paused={engine.isPaused}
        />
      </div>
    </>
  )
}
