"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Loader2, Wand2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useAuth } from "@/lib/auth"
import { useBackendStatus } from "@/lib/backend"
import { useTranslations } from "@/lib/i18n"
import { useInspiration } from "@/lib/flowfic/inspiration"
import { useGameEngine } from "@/lib/flowfic/use-game-engine"
import { useStories } from "@/lib/flowfic/use-stories"
import type { GameSettings } from "@/lib/flowfic/types"
import type { Story } from "@/lib/flowfic/stories-api"

import { SECTION_META, type Section } from "./dashboard-nav"
import { pathToScreen, screenToPath, type Screen } from "./navigation"
import { AppHeader } from "./app-header"
import { DetailScreen } from "./detail-screen"
import { GamificationProvider } from "./gamification-context"
import { GameHud } from "./game-hud"
import { InspirationPane } from "./inspiration-panel"
import { JourneySection } from "./journey-section"
import { LandingHome } from "./landing"
import { type GridMode } from "./preset-grid"
import { ProfilePanel } from "./profile-panel"
import { ResultsModal } from "./results-modal"
import { StoriesSection } from "./stories-section"
import { WelcomeModal } from "./welcome-modal"
import { WritingArea } from "./writing-area"

const WELCOME_STORAGE_KEY = "flowfic.welcome.dismissed"

export function Dashboard() {
  const t = useTranslations()
  const { status: authStatus } = useAuth()
  const { devUserEnabled } = useBackendStatus()
  const engine = useGameEngine()

  const {
    stories,
    error: storiesError,
    remove: removeStory,
    update: updateStoryTitle,
  } = useStories(engine.storiesRefreshKey)

  // Initial screen comes from the URL so a deep link / refresh lands on the
  // right place (the game tree is `dynamic(ssr:false)`, so `window` exists).
  const [screen, setScreen] = useState<Screen>(() =>
    typeof window === "undefined"
      ? { name: "landing" }
      : pathToScreen(window.location.pathname),
  )
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  // Mode grid face, held here so flipping it survives the panel toggling and
  // a trip into a detail screen and back.
  const [gridMode, setGridMode] = useState<GridMode>("system")
  // Quit confirmation. Opening it pauses the sprint; cancelling leaves it
  // paused, since the player can't interact with the editor while it is up.
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false)
  // Whether the in-game inspiration pane is expanded (desktop only).
  const [inspirationOpen, setInspirationOpen] = useState(true)
  const { state: inspirationState } = useInspiration()
  const hasInspiration =
    inspirationState.status === "image" || inspirationState.status === "quote"

  const inGame =
    engine.gameState === "playing" ||
    engine.gameState === "paused" ||
    engine.gameState === "ended"
  const loading = engine.gameState === "loading"
  // Left/right split (the game on the left, inspiration on the right) applies
  // once a session starts. Desktop only — the inspiration column is hidden on
  // mobile — and only when the player actually picked an inspiration.
  const splitLayout = loading || inGame

  // ---- First-visit welcome (anonymous only) ------------------------------
  useEffect(() => {
    if (authStatus === "loading" || authStatus === "authenticated") return
    if (typeof window !== "undefined") {
      try {
        if (window.localStorage.getItem(WELCOME_STORAGE_KEY) === "1") return
      } catch {
        // localStorage unavailable; fall through to show the welcome modal.
      }
    }
    setWelcomeOpen(true)
  }, [authStatus])

  function dismissWelcome(dontShowAgain: boolean) {
    if (dontShowAgain && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(WELCOME_STORAGE_KEY, "1")
      } catch {
        // ignore
      }
    }
    setWelcomeOpen(false)
  }

  // ---- URL-synced navigation ---------------------------------------------
  // Drive the visible screen through the History API so Back/Forward, refresh,
  // and deep links work while staying a single static bundle. Stable content
  // screens own a URL (see navigation.ts); the transient `configuring`/game
  // states keep the split layout. `notfound` has no path, so it leaves the
  // (unknown) URL untouched — a refresh then still renders not-found.
  const navigate = useCallback((next: Screen, opts?: { replace?: boolean }) => {
    if (typeof window !== "undefined") {
      const path = screenToPath(next)
      if (path !== null) {
        if (opts?.replace) window.history.replaceState(null, "", path)
        else if (window.location.pathname !== path)
          window.history.pushState(null, "", path)
      }
    }
    setScreen(next)
  }, [])

  // Save any just-finished story before leaving the game area.
  const leaveGame = useCallback(() => {
    if (engine.gameState === "ended") engine.finishAndReset()
  }, [engine])

  // Sync the screen when the user presses Back/Forward. Mid-game, Back quits
  // the session and stays in-app rather than tearing the tree down or leaving
  // the document (that jump-to-Auth0-on-back was the reported auth bug). The
  // handler is kept in a ref so the single listener always sees fresh state.
  const popStateRef = useRef<() => void>(() => {})
  useEffect(() => {
    popStateRef.current = () => {
      if (engine.isPlaying) engine.quit()
      else leaveGame()
      setScreen(pathToScreen(window.location.pathname))
    }
  })
  useEffect(() => {
    const handler = () => popStateRef.current()
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [])

  // ---- Reset navigation on logout ----------------------------------------
  const prevAuthRef = useRef(authStatus)
  useEffect(() => {
    const prev = prevAuthRef.current
    prevAuthRef.current = authStatus
    if (prev === "authenticated" && authStatus === "anonymous") {
      navigate({ name: "landing" }, { replace: true })
    }
  }, [authStatus, navigate])

  // ---- Navigation helpers ------------------------------------------------
  function goHome() {
    leaveGame()
    navigate({ name: "landing" })
  }

  function showSection(section: Section) {
    leaveGame()
    navigate({ name: "section", section })
  }

  function openProfile() {
    leaveGame()
    navigate({ name: "profile" })
  }

  function onViewStory(story: Story) {
    leaveGame()
    navigate({ name: "story", id: story.id })
  }

  // "Start writing": start the sprint with the configured settings. Reached
  // from the launcher's Start button and its challenge card.
  function startWriting() {
    engine.saveCurrentStoryIfNeeded()
    engine.startGame(engine.settings)
  }

  // Final checkout of a finished sprint: save, wipe, back to home.
  function finishStory() {
    engine.finishAndReset()
    navigate({ name: "landing" })
  }

  // The advanced-settings face of the home panel is URL-backed (/new), so it
  // survives a refresh and Back closes it.
  const settingsOpen = screen.name === "configuring"
  function toggleSettingsPanel() {
    navigate({ name: settingsOpen ? "landing" : "configuring" })
  }

  // Quit asks first. The confirmation freezes the sprint while it is up —
  // cancelling leaves it paused rather than dropping the player back into a
  // running clock they weren't watching.
  function requestQuit() {
    engine.pause()
    setQuitConfirmOpen(true)
  }
  function confirmQuit() {
    setQuitConfirmOpen(false)
    engine.quit()
  }

  const controlsDisabled = engine.isPlaying || engine.isPaused || loading

  return (
    <GamificationProvider refreshKey={engine.storiesRefreshKey}>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <AppHeader
          authStatus={authStatus}
          devUserEnabled={devUserEnabled}
          disabled={controlsDisabled}
          onGoHome={goHome}
          onShowSection={showSection}
          onOpenProfile={openProfile}
        />

        <main className="min-h-0 flex-1">
          {splitLayout ? (
            <div className="flex h-full min-h-0">
              {/* Left: the game area. */}
              <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
                {loading ? (
                  <LoadingSplash />
                ) : (
                  <GameArea engine={engine} onQuit={requestQuit} onFinish={finishStory} />
                )}
              </div>
              {/* Right: the inspiration the player picked before starting —
                  only when they picked one. Collapsible via the wand rail, so
                  the writing column can take the full width. Desktop only. */}
              {hasInspiration ? (
                <aside
                  className={cn(
                    "bg-card/40 hidden shrink-0 overflow-hidden border-l md:flex",
                    inspirationOpen ? "w-5/12" : "w-auto",
                  )}
                >
                  <div className="flex flex-col items-center p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setInspirationOpen((open) => !open)}
                      aria-expanded={inspirationOpen}
                      aria-label={
                        inspirationOpen ? t.game.inspirationHide : t.game.inspirationShow
                      }
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Wand2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                  {inspirationOpen ? (
                    <div className="min-w-0 flex-1 py-4 pr-4 sm:py-6 sm:pr-6">
                      <InspirationPane />
                    </div>
                  ) : null}
                </aside>
              ) : null}
            </div>
          ) : (
            <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
              <ScreenContent
                screen={screen}
                settings={engine.settings}
                onChangeSettings={engine.setSettings}
                onStart={startWriting}
                settingsOpen={settingsOpen}
                onToggleSettings={toggleSettingsPanel}
                gridMode={gridMode}
                onToggleGridMode={() =>
                  setGridMode((m) => (m === "system" ? "custom" : "system"))
                }
                stories={stories}
                storiesError={storiesError}
                onShowSection={showSection}
                onViewStory={onViewStory}
                onDeleteStory={removeStory}
                onUpdateStoryTitle={updateStoryTitle}
                onBackHome={goHome}
                onBackToStories={() => showSection("stories")}
              />
            </div>
          )}
        </main>
      </div>

      <AlertDialog
        open={quitConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setQuitConfirmOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.game.quitConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.game.quitConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* Cancelling deliberately leaves the sprint paused. */}
            <AlertDialogCancel>{t.game.quitCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmQuit()
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t.game.quitConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WelcomeModal open={welcomeOpen && authStatus !== "loading"} onContinue={dismissWelcome} />
      <ResultsModal
        open={engine.gameState === "ended" && engine.resultsModalOpen}
        result={engine.result}
        onClose={engine.closeResultsModal}
      />
    </GamificationProvider>
  )
}

// ---- Game area (left column while loading/playing/ended) -----------------

function LoadingSplash() {
  const t = useTranslations()
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-4">
      <Loader2 className="text-primary size-10 animate-spin" aria-hidden />
      <span className="text-muted-foreground text-sm">{t.settings.loadingWords}</span>
    </div>
  )
}

function GameArea({
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
      <div className="relative flex min-h-0 flex-1">
        <WritingArea
          ref={engine.textareaRef}
          value={engine.text}
          onChange={engine.handleChange}
          matches={engine.matches}
          readOnly={engine.isPaused}
        />
        {/* Paused: veil the story so the frozen state is unmistakable and the
            text can't be read/edited past the pause. */}
        {engine.isPaused ? (
          <div
            role="status"
            className="bg-background/80 absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg backdrop-blur-sm"
          >
            <span className="text-xl font-semibold">{t.game.paused}</span>
            <span className="text-muted-foreground text-sm">{t.game.pausedHint}</span>
          </div>
        ) : null}
      </div>
    </>
  )
}

// ---- Non-split screens (landing / detail subsections / profile / story) --

function ScreenContent({
  screen,
  settings,
  onChangeSettings,
  onStart,
  settingsOpen,
  onToggleSettings,
  gridMode,
  onToggleGridMode,
  stories,
  storiesError,
  onShowSection,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
  onBackHome,
  onBackToStories,
}: {
  screen: Screen
  settings: GameSettings
  onChangeSettings: (settings: GameSettings) => void
  onStart: () => void
  settingsOpen: boolean
  onToggleSettings: () => void
  gridMode: GridMode
  onToggleGridMode: () => void
  stories: Story[] | null
  storiesError: boolean
  onShowSection: (section: Section) => void
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateStoryTitle: (id: number, title: string | null) => Promise<boolean>
  onBackHome: () => void
  onBackToStories: () => void
}) {
  const t = useTranslations()

  switch (screen.name) {
    // `landing` and `configuring` are the same screen; the latter just has the
    // advanced-settings face of its panel open (and owns the /new URL).
    case "landing":
    case "configuring":
      return (
        <LandingHome
          settings={settings}
          onChangeSettings={onChangeSettings}
          onStart={onStart}
          settingsOpen={settingsOpen}
          onToggleSettings={onToggleSettings}
          gridMode={gridMode}
          onToggleGridMode={onToggleGridMode}
          onShowSection={onShowSection}
          stories={stories}
          storiesError={storiesError}
          onViewStory={onViewStory}
          onDeleteStory={onDeleteStory}
          onUpdateStoryTitle={onUpdateStoryTitle}
        />
      )
    case "section":
      return (
        <DetailScreen title={SECTION_META[screen.section].title(t)} onBack={onBackHome}>
          <SectionDetail
            section={screen.section}
            stories={stories}
            storiesError={storiesError}
            onNewStory={onBackHome}
            onViewStory={onViewStory}
            onDeleteStory={onDeleteStory}
            onUpdateStoryTitle={onUpdateStoryTitle}
          />
        </DetailScreen>
      )
    case "profile":
      return (
        <DetailScreen title={t.profile.title} onBack={onBackHome}>
          <ProfilePanel />
        </DetailScreen>
      )
    case "story": {
      // The screen only carries the id (so a deep link / refresh at
      // /stories/:id reconstructs it); resolve the record from the loaded
      // list. `null` list means the first load is still in flight.
      const story = stories?.find((s) => s.id === screen.id) ?? null
      if (stories === null) {
        return (
          <DetailScreen title={t.game.viewingStory} onBack={onBackToStories} backLabel={t.nav.backToStories}>
            <div role="status" aria-live="polite" className="flex justify-center py-16">
              <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
            </div>
          </DetailScreen>
        )
      }
      if (story === null) return <NotFoundScreen onBack={onBackToStories} backLabel={t.nav.backToStories} />
      return (
        <DetailScreen title={t.game.viewingStory} onBack={onBackToStories} backLabel={t.nav.backToStories}>
          <div className="h-[65vh]">
            <WritingArea value={story.text} onChange={() => {}} matches={[]} readOnly />
          </div>
        </DetailScreen>
      )
    }
    case "notfound":
      return <NotFoundScreen onBack={onBackHome} />
    // `configuring` is rendered by the split layout, not here.
    default:
      return null
  }
}

// Client-rendered not-found screen (no server 404 — the shell is served for
// every app path). Reached for an unknown URL or a story id that doesn't
// resolve; the back arrow returns to a sensible in-app screen.
function NotFoundScreen({ onBack, backLabel }: { onBack: () => void; backLabel?: string }) {
  const t = useTranslations()
  // The arrow + button share one destination; label both after it so the copy
  // matches where they lead (home by default, the stories list from a story).
  const label = backLabel ?? t.notFound.backHome
  return (
    <DetailScreen title={t.notFound.title} onBack={onBack} backLabel={label}>
      <div className="flex flex-col items-start gap-4 py-8">
        <p className="text-muted-foreground">{t.notFound.body}</p>
        <Button type="button" variant="outline" onClick={onBack}>
          {label}
        </Button>
      </div>
    </DetailScreen>
  )
}

function SectionDetail({
  section,
  stories,
  storiesError,
  onNewStory,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
}: {
  section: Section
  stories: Story[] | null
  storiesError: boolean
  onNewStory: () => void
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateStoryTitle: (id: number, title: string | null) => Promise<boolean>
}) {
  switch (section) {
    case "stories":
      return (
        <StoriesSection
          stories={stories}
          error={storiesError}
          onViewStory={onViewStory}
          onDeleteStory={onDeleteStory}
          onUpdateTitle={onUpdateStoryTitle}
        />
      )
    case "journey":
      return <JourneySection onNewStory={onNewStory} />
  }
}
