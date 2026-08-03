"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Home, Loader2, Pencil, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useAuth } from "@/lib/auth"
import { useBackendStatus } from "@/lib/backend"
import { useTranslations } from "@/lib/i18n"
import { useGameEngine } from "@/lib/flowfic/use-game-engine"
import { useStories } from "@/lib/flowfic/use-stories"
import type { Story } from "@/lib/flowfic/stories-api"

import { SECTION_META, type Section } from "./dashboard-nav"
import { pathToScreen, screenToPath, type Screen } from "./navigation"
import { AppHeader } from "./app-header"
import { DetailScreen } from "./detail-screen"
import { GamificationProvider } from "./gamification-context"
import { GameHud } from "./game-hud"
import { ZoomableInspirationImage } from "./inspiration-panel"
import { JourneySection } from "./journey-section"
import { LandingHome } from "./landing"
import { ProfilePanel } from "./profile-panel"
import { ResultsModal } from "./results-modal"
import { SettingsPanel } from "./settings-panel"
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

  const inGame = engine.gameState === "playing" || engine.gameState === "ended"
  const loading = engine.gameState === "loading"
  // Left/right split (settings or game on the left, inspiration on the right)
  // is used whenever a session is being configured or played. Desktop only —
  // the inspiration column is hidden on mobile.
  const splitLayout = screen.name === "configuring" || loading || inGame

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

  // "New story": reveal the session configurator (engine stays idle). This
  // pushes the /new entry so Back during setup/play returns here in-app.
  function beginNewStory() {
    leaveGame()
    navigate({ name: "configuring" })
  }

  // "Start writing": start the sprint with the configured settings.
  function startWriting() {
    engine.saveCurrentStoryIfNeeded()
    engine.startGame(engine.settings)
  }

  // "Create a story" (ended state): finalize the finished sprint, back to home.
  function finishStory() {
    engine.finishAndReset()
    navigate({ name: "landing" })
  }

  // ---- Primary action ----------------------------------------------------
  // New story (Sparkles) → Start writing (Pencil, on the configuring screen)
  // → Quit (X, while playing) → Create a story (Sparkles, ended state).
  const primaryAction = primaryActionFor()

  function primaryActionFor() {
    if (engine.isPlaying) {
      return (
        <ActionButton
          icon={<X className="size-4" aria-hidden />}
          label={t.game.quit}
          shortLabel={t.game.quitShort}
          onClick={engine.quit}
        />
      )
    }
    if (engine.gameState === "ended") {
      // Finished sprint, text still editable: the action just returns home
      // (saving the story on the way out via finishStory -> leaveGame path).
      return (
        <ActionButton
          icon={<Home className="size-4" aria-hidden />}
          label={t.nav.backToHome}
          shortLabel={t.nav.backToHomeShort}
          onClick={finishStory}
        />
      )
    }
    if (loading) return null
    if (screen.name === "configuring") {
      return (
        <ActionButton
          icon={<Pencil className="size-4" aria-hidden />}
          label={t.settings.start}
          shortLabel={t.settings.startShort}
          onClick={startWriting}
        />
      )
    }
    return (
      <ActionButton
        icon={<Sparkles className="size-4" aria-hidden />}
        label={t.nav.newStory}
        shortLabel={t.nav.newStoryShort}
        onClick={beginNewStory}
      />
    )
  }

  const controlsDisabled = engine.isPlaying || loading

  return (
    <GamificationProvider refreshKey={engine.storiesRefreshKey}>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <AppHeader
          primaryAction={primaryAction}
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
              {/* Left: game area or session settings. */}
              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6",
                  inGame || loading ? "overflow-hidden" : "overflow-y-auto",
                )}
              >
                {loading ? (
                  <LoadingSplash />
                ) : inGame ? (
                  <GameArea engine={engine} />
                ) : (
                  <SettingsPanel settings={engine.settings} onChange={engine.setSettings} />
                )}
              </div>
              {/* Right: inspiration image only (5/12), desktop only. Fills the
                  pane height; scroll to zoom (see ZoomableInspirationImage). */}
              <aside className="bg-card/40 hidden w-5/12 shrink-0 overflow-hidden border-l p-4 sm:p-6 md:block">
                <ZoomableInspirationImage />
              </aside>
            </div>
          ) : (
            <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
              <ScreenContent
                screen={screen}
                stories={stories}
                storiesError={storiesError}
                onShowSection={showSection}
                onNewStory={beginNewStory}
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

function GameArea({ engine }: { engine: ReturnType<typeof useGameEngine> }) {
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
      />
      <div className="flex min-h-0 flex-1">
        <WritingArea
          ref={engine.textareaRef}
          value={engine.text}
          onChange={engine.handleChange}
          matches={engine.matches}
        />
      </div>
    </>
  )
}

// ---- Non-split screens (landing / detail subsections / profile / story) --

function ScreenContent({
  screen,
  stories,
  storiesError,
  onShowSection,
  onNewStory,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
  onBackHome,
  onBackToStories,
}: {
  screen: Screen
  stories: Story[] | null
  storiesError: boolean
  onShowSection: (section: Section) => void
  onNewStory: () => void
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateStoryTitle: (id: number, title: string | null) => Promise<boolean>
  onBackHome: () => void
  onBackToStories: () => void
}) {
  const t = useTranslations()

  switch (screen.name) {
    case "landing":
      return (
        <LandingHome
          onShowSection={onShowSection}
          onNewStory={onNewStory}
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
            onNewStory={onNewStory}
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

function ActionButton({
  icon,
  label,
  shortLabel,
  onClick,
}: {
  icon: React.ReactNode
  /** Full text: shown from `sm` up and used as the accessible name (+ e2e handle). */
  label: string
  /** Compact text (Create / Write / Quit / Home) shown only on mobile. */
  shortLabel: string
  onClick: () => void
}) {
  return (
    // Top-bar height (h-10). Mobile shows the short label at natural width; from
    // `sm` up it swaps to the full label with a fixed width so the button never
    // resizes between game states. The full label is always the accessible name.
    <Button
      onClick={onClick}
      aria-label={label}
      className="h-10 w-auto justify-center gap-1.5 sm:w-48"
    >
      {icon}
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}
