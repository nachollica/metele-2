"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, ArrowLeft, Loader2, PanelLeft, Pencil, Sparkles, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/components/ui/use-mobile"
import { cn } from "@/lib/utils"

import { DevLoginButton } from "@/components/auth/dev-login-button"
import { useAuth } from "@/lib/auth"
import { useBackendStatus } from "@/lib/backend"
import { useTranslations } from "@/lib/i18n"
import { useGameEngine } from "@/lib/flowfic/use-game-engine"
import { useStories } from "@/lib/flowfic/use-stories"
import type { Story } from "@/lib/flowfic/stories-api"

import { type Section } from "./dashboard-nav"
import { AccountMenu } from "./account-menu"
import { DashboardSidebar } from "./dashboard-sidebar"
import { DashboardHome } from "./dashboard-home"
import { AchievementsSection } from "./achievements-section"
import { ChallengesSection } from "./challenges-section"
import { GamificationProvider } from "./gamification-context"
import { GameHud } from "./game-hud"
import { ProfilePanel } from "./profile-panel"
import { ResultsModal } from "./results-modal"
import { StatsSection } from "./stats-section"
import { StoriesSection } from "./stories-section"
import { WelcomeModal } from "./welcome-modal"
import { WritingArea } from "./writing-area"

const WELCOME_STORAGE_KEY = "flowfic.welcome.dismissed"

export function Dashboard() {
  const t = useTranslations()
  const { status: authStatus } = useAuth()
  const { devUserEnabled } = useBackendStatus()
  const engine = useGameEngine()
  const isMobile = useIsMobile()

  const {
    stories,
    error: storiesError,
    remove: removeStory,
    update: updateStoryTitle,
  } = useStories(engine.storiesRefreshKey)

  const [section, setSection] = useState<Section>("home")
  const [viewingStory, setViewingStory] = useState<Story | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)

  const inGame = engine.gameState === "playing" || engine.gameState === "ended"
  const loading = engine.gameState === "loading"
  const fillLayout = inGame || loading || viewingStory !== null

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
      setSection("home")
      setViewingStory(null)
      setProfileOpen(false)
    }
  }, [authStatus])

  // ---- Navigation helpers ------------------------------------------------
  // Save any just-finished story before leaving the game area.
  function leaveGame() {
    if (engine.gameState === "ended") engine.finishAndReset()
  }

  function selectSection(next: Section) {
    leaveGame()
    setProfileOpen(false)
    setViewingStory(null)
    setSection(next)
    setSheetOpen(false)
  }

  function onViewStory(story: Story) {
    leaveGame()
    setProfileOpen(false)
    setViewingStory(story)
  }

  function openProfile() {
    leaveGame()
    setViewingStory(null)
    setProfileOpen(true)
  }

  function startNewStory() {
    engine.saveCurrentStoryIfNeeded()
    setViewingStory(null)
    setProfileOpen(false)
    engine.startGame(engine.settings)
  }

  function finishStory() {
    engine.finishAndReset()
    setViewingStory(null)
    setProfileOpen(false)
    setSection("home")
  }

  // ---- Primary action ----------------------------------------------------
  // The top bar carries no text on any screen — just the game action (left)
  // and the account control (right).
  const primaryAction = primaryActionFor()

  function primaryActionFor() {
    if (engine.isPlaying) {
      return (
        <ActionButton icon={<X className="size-4" aria-hidden />} label={t.game.quit} onClick={engine.quit} />
      )
    }
    if (engine.gameState === "ended") {
      return (
        <ActionButton
          icon={<Sparkles className="size-4" aria-hidden />}
          label={t.game.createStory}
          onClick={finishStory}
        />
      )
    }
    if (loading) return null
    return (
      <ActionButton
        icon={<Pencil className="size-4" aria-hidden />}
        label={t.settings.start}
        onClick={startNewStory}
      />
    )
  }

  const sidebar = (
    <DashboardSidebar
      active={section}
      onSelect={selectSection}
      disabled={engine.isPlaying || loading}
    />
  )

  return (
    <GamificationProvider refreshKey={engine.storiesRefreshKey}>
      <div className="bg-background text-foreground flex h-dvh">
        {/* Desktop sidebar */}
        <aside className="bg-card hidden w-64 shrink-0 border-r md:block" aria-label={t.nav.label}>
          {sidebar}
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-sm p-0 sm:max-w-sm">
            <SheetHeader className="sr-only">
              <SheetTitle>{t.nav.label}</SheetTitle>
              <SheetDescription>{t.dashboard.subtitle}</SheetDescription>
            </SheetHeader>
            {sidebar}
          </SheetContent>
        </Sheet>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="bg-card/60 flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {isMobile ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSheetOpen(true)}
                  disabled={engine.isPlaying || loading}
                  aria-label={t.nav.openMenu}
                >
                  <PanelLeft className="size-4" aria-hidden />
                </Button>
              ) : null}
              {/* Primary action (Start / Quit / Create a story) anchors the
                  top-left, same slot on every screen. No title text. */}
              {primaryAction}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Dev-user backdoor stays a header-only shortcut (never in the
                  account menu); shown only while anonymous and only when the
                  backend reports it enabled. */}
              {authStatus === "anonymous" && devUserEnabled ? (
                <DevLoginButton disabled={engine.isPlaying || loading} />
              ) : null}
              {/* Login / avatar-menu, top-right. */}
              <AccountMenu onOpenProfile={openProfile} disabled={engine.isPlaying || loading} />
            </div>
          </header>

          <div
            className={cn(
              "flex-1",
              fillLayout
                ? "flex min-h-0 flex-col gap-4 p-4 sm:p-6"
                : "min-h-0 overflow-y-auto p-4 sm:p-6",
            )}
          >
            {engine.failedSave !== null && inGame ? (
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

            {loading ? (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-1 flex-col items-center justify-center gap-4"
              >
                <Loader2 className="text-primary size-10 animate-spin" aria-hidden />
                <span className="text-muted-foreground text-sm">{t.settings.loadingWords}</span>
              </div>
            ) : inGame ? (
              <>
                <GameHud
                  idleSecondsLeft={engine.idleSecondsLeft}
                  idleSecondsTotal={engine.settings.mainTimerSeconds}
                  globalSecondsLeft={engine.globalSecondsLeft}
                  globalSecondsTotal={engine.settings.globalTimerSeconds}
                  requiredWordsEnabled={engine.settings.requiredWordIntervalEnabled}
                  requiredWord={engine.currentRequiredWord}
                  useWordIn={engine.useWordIn !== null ? Math.ceil(engine.useWordIn) : null}
                  useWordTotal={
                    engine.settings.requiredWordUseTimerEnabled
                      ? engine.settings.requiredWordUseTimerSeconds
                      : null
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
            ) : viewingStory ? (
              <>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setViewingStory(null)}>
                    <ArrowLeft className="size-4" aria-hidden />
                    {t.dashboard.back}
                  </Button>
                  <span className="text-muted-foreground text-xs italic">{t.game.viewingStory}</span>
                </div>
                <div className="flex min-h-0 flex-1">
                  <WritingArea value={viewingStory.text} onChange={() => {}} matches={[]} readOnly />
                </div>
              </>
            ) : profileOpen ? (
              <ProfilePanel />
            ) : (
              <SectionContent
                section={section}
                engine={engine}
                stories={stories}
                storiesError={storiesError}
                onNewStory={startNewStory}
                onViewStory={onViewStory}
                onDeleteStory={removeStory}
                onUpdateStoryTitle={updateStoryTitle}
              />
            )}
          </div>
        </div>
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

function SectionContent({
  section,
  engine,
  stories,
  storiesError,
  onNewStory,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
}: {
  section: Section
  engine: ReturnType<typeof useGameEngine>
  stories: Story[] | null
  storiesError: boolean
  onNewStory: () => void
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateStoryTitle: (id: number, title: string | null) => Promise<boolean>
}) {
  switch (section) {
    case "home":
      return (
        <DashboardHome settings={engine.settings} onSettingsChange={engine.setSettings} />
      )
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
    // Fixed generous width so every state's label (Start writing / Quit
    // session / Create a story, in either language) fits without the button
    // resizing between states.
    <Button onClick={onClick} size="sm" className="w-48 justify-center gap-1.5">
      {icon}
      {label}
    </Button>
  )
}
