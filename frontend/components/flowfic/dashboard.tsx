"use client"

import { useEffect, useRef, useState } from "react"
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
import { AppHeader } from "./app-header"
import { AchievementsSection } from "./achievements-section"
import { ChallengesSection } from "./challenges-section"
import { DetailScreen } from "./detail-screen"
import { GamificationProvider } from "./gamification-context"
import { GameHud } from "./game-hud"
import { InspirationImage } from "./inspiration-panel"
import { LandingHome } from "./landing"
import { ProfilePanel } from "./profile-panel"
import { ResultsModal } from "./results-modal"
import { SettingsPanel } from "./settings-panel"
import { StatsSection } from "./stats-section"
import { StoriesSection } from "./stories-section"
import { WelcomeModal } from "./welcome-modal"
import { WritingArea } from "./writing-area"

const WELCOME_STORAGE_KEY = "flowfic.welcome.dismissed"

// The single-route app has no URL-driven navigation: the visible main-area
// screen is this local state. Engine states (loading/playing/ended) take
// precedence over it and render the game.
type Screen =
  | { name: "landing" }
  | { name: "configuring" } // session settings shown, engine still idle
  | { name: "section"; section: Section }
  | { name: "profile" }
  | { name: "story"; story: Story }

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

  const [screen, setScreen] = useState<Screen>({ name: "landing" })
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

  // ---- Reset navigation on logout ----------------------------------------
  const prevAuthRef = useRef(authStatus)
  useEffect(() => {
    const prev = prevAuthRef.current
    prevAuthRef.current = authStatus
    if (prev === "authenticated" && authStatus === "anonymous") {
      setScreen({ name: "landing" })
    }
  }, [authStatus])

  // ---- Navigation helpers ------------------------------------------------
  // Save any just-finished story before leaving the game area.
  function leaveGame() {
    if (engine.gameState === "ended") engine.finishAndReset()
  }

  function goHome() {
    leaveGame()
    setScreen({ name: "landing" })
  }

  function showSection(section: Section) {
    leaveGame()
    setScreen({ name: "section", section })
  }

  function openProfile() {
    leaveGame()
    setScreen({ name: "profile" })
  }

  function onViewStory(story: Story) {
    leaveGame()
    setScreen({ name: "story", story })
  }

  // "New story": reveal the session configurator (engine stays idle).
  function beginNewStory() {
    leaveGame()
    setScreen({ name: "configuring" })
  }

  // "Start writing": start the sprint with the configured settings.
  function startWriting() {
    engine.saveCurrentStoryIfNeeded()
    engine.startGame(engine.settings)
  }

  // "Create a story" (ended state): finalize the finished sprint, back to home.
  function finishStory() {
    engine.finishAndReset()
    setScreen({ name: "landing" })
  }

  // ---- Primary action ----------------------------------------------------
  // New story (Sparkles) → Start writing (Pencil, on the configuring screen)
  // → Quit (X, while playing) → Create a story (Sparkles, ended state).
  const primaryAction = primaryActionFor()

  function primaryActionFor() {
    if (engine.isPlaying) {
      return <ActionButton icon={<X className="size-4" aria-hidden />} label={t.game.quit} onClick={engine.quit} />
    }
    if (engine.gameState === "ended") {
      // Finished sprint, text still editable: the action just returns home
      // (saving the story on the way out via finishStory -> leaveGame path).
      return (
        <ActionButton
          icon={<Home className="size-4" aria-hidden />}
          label={t.nav.backToHome}
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
          onClick={startWriting}
        />
      )
    }
    return (
      <ActionButton
        icon={<Sparkles className="size-4" aria-hidden />}
        label={t.nav.newStory}
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
              {/* Right: inspiration image only (5/12), desktop only. The image
                  fills the width and is centered vertically in the column. */}
              <aside className="bg-card/40 hidden w-5/12 shrink-0 flex-col justify-center overflow-y-auto border-l p-4 sm:p-6 md:flex">
                <InspirationImage />
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
    case "story":
      return (
        <DetailScreen title={t.game.viewingStory} onBack={onBackToStories}>
          <div className="h-[65vh]">
            <WritingArea value={screen.story.text} onChange={() => {}} matches={[]} readOnly />
          </div>
        </DetailScreen>
      )
    // `configuring` is rendered by the split layout, not here.
    default:
      return null
  }
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
    case "challenges":
      return <ChallengesSection onNewStory={onNewStory} />
    case "stats":
      return <StatsSection />
    case "achievements":
      return <AchievementsSection />
  }
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    // Fixed generous width so every state's label (New story / Start writing /
    // Quit session / Create a story, in either language) fits without the
    // button resizing between states.
    <Button onClick={onClick} size="sm" className="w-48 justify-center gap-1.5">
      {icon}
      {label}
    </Button>
  )
}
