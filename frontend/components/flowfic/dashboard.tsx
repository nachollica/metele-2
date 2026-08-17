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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

import { useAuth } from "@/lib/auth"
import { useBackendStatus } from "@/lib/backend"
import { useTranslations } from "@/lib/i18n"
import { useInspiration } from "@/lib/flowfic/inspiration"
import { deriveTitle } from "@/lib/flowfic/gamification"
import { useGameEngine } from "@/lib/flowfic/use-game-engine"
import { useStories } from "@/lib/flowfic/use-stories"
import type { GameSettings } from "@/lib/flowfic/types"
import type { Story } from "@/lib/flowfic/stories-api"

import { type Section } from "./dashboard-nav"
import { pathToScreen, screenToPath, type Screen } from "./navigation"
import { screenHeader } from "./screen-header"
import { AppHeader } from "./app-header"
import { ContentColumn } from "./dashboard-widgets"
import { GamificationProvider } from "./gamification-context"
import { GameHud } from "./game-hud"
import { InspirationPane } from "./inspiration-panel"
import { ProgressSection } from "./progress-section"
import { LandingHome } from "./landing"
import { type ShowcaseFace } from "./landing-showcase"
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
    total: storiesTotal,
    hasMore: storiesHasMore,
    loadingMore: storiesLoadingMore,
    loadMore: loadMoreStories,
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
  // Showcase face, held here for the same reason. Inspiration is the default:
  // it is the one face that reads the same signed in or out, and it is the
  // app's own invitation rather than a sign-in prompt.
  const [showcaseFace, setShowcaseFace] = useState<ShowcaseFace>("inspiration")
  // Quit confirmation. Opening it pauses the sprint; cancelling leaves it
  // paused, since the player can't interact with the editor while it is up.
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false)
  // Whether the in-game inspiration pane is expanded (desktop only).
  const [inspirationOpen, setInspirationOpen] = useState(true)
  const { state: inspirationState, clear: clearInspiration } = useInspiration()
  const hasInspiration =
    inspirationState.status === "image" || inspirationState.status === "quote"
  // The pane is only up when there is something to put in it AND the player
  // hasn't collapsed it. Everything else — collapsed, or never picked — is the
  // same centred layout, so the two cases share one flag.
  const paneShown = hasInspiration && inspirationOpen

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
  //
  // The showcase decides whether the sprint gets an inspiration: starting with
  // that circle selected carries the pick into the game, starting from any other
  // face drops it. So the player asks for an inspiration by looking at one, and
  // the pane never appears beside a session they didn't want it for.
  function startWriting() {
    if (showcaseFace !== "inspiration") clearInspiration()
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

  // Quit asks first, and the confirmation freezes the sprint while it is up —
  // cancelling leaves it paused rather than dropping the player back into a
  // running clock they weren't watching. Before the first keystroke there is
  // nothing to lose, so it just leaves.
  function requestQuit() {
    if (!engine.armed) {
      engine.quit()
      return
    }
    engine.pause()
    setQuitConfirmOpen(true)
  }
  function confirmQuit() {
    setQuitConfirmOpen(false)
    engine.quit()
  }

  const controlsDisabled = engine.isPlaying || engine.isPaused || loading

  // A story screen only carries the id (so a deep link / refresh at
  // /stories/:id reconstructs it); resolve the record once here, and share the
  // verdict with both the header and the screen so the two never disagree.
  // `stories === null` means the first load is still in flight.
  const currentStory = screen.name === "story" ? (stories?.find((s) => s.id === screen.id) ?? null) : null
  const storyMissing = screen.name === "story" && stories !== null && currentStory === null

  // Title + back arrow for the header. Mid-sprint the bar stays empty.
  const header = screenHeader(screen, t, { storyMissing })
  const headerBack = header.backTo === "stories" ? () => showSection("stories") : goHome

  return (
    <GamificationProvider refreshKey={engine.storiesRefreshKey}>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <AppHeader
          authStatus={authStatus}
          devUserEnabled={devUserEnabled}
          disabled={controlsDisabled}
          title={splitLayout ? null : header.title}
          onBack={header.backTo !== null ? headerBack : undefined}
          backLabel={header.backLabel}
          onGoHome={goHome}
          onShowSection={showSection}
          onOpenProfile={openProfile}
        />

        <main className="min-h-0 flex-1">
          {splitLayout ? (
            // Two shapes, depending on whether the inspiration pane is up:
            //   shown  — writing column beside a 5/12 pane, as the split has
            //            always been.
            //   centred — the writing column falls back to the app's shared
            //            measure (the same one the home screen uses) between two
            //            equal gutters. The right one holds the wand when there
            //            is a hidden inspiration to bring back, and is simply
            //            empty when none was ever picked. BOTH gutters have to
            //            render either way: one alone would push the column off
            //            to the opposite edge.
            <div className="flex h-full min-h-0">
              {paneShown ? null : <div className="hidden flex-1 md:block" aria-hidden />}

              <div
                className={cn(
                  "flex min-w-0 flex-col gap-4 overflow-hidden p-4 sm:p-6",
                  // Beside an open pane it takes whatever is left. Centred, it
                  // claims the shared measure outright and the flex-1 gutters
                  // split the remainder — it must NOT be flex-1 itself, or it
                  // would just take a third of the row alongside them.
                  paneShown ? "flex-1" : "w-full max-w-5xl",
                )}
              >
                {loading ? (
                  <LoadingSplash />
                ) : (
                  <GameArea engine={engine} onQuit={requestQuit} onFinish={finishStory} />
                )}
              </div>

              {/* The pane itself is the hide control: the pick is frozen for
                  the sprint, so a click can't mean "re-roll" the way it does on
                  the home card. Desktop only. */}
              {paneShown ? (
                <aside className="bg-card/40 hidden w-5/12 shrink-0 overflow-hidden border-l p-4 sm:p-6 md:block">
                  <button
                    type="button"
                    onClick={() => setInspirationOpen(false)}
                    aria-expanded
                    aria-label={t.game.inspirationHide}
                    className="focus-visible:ring-ring block size-full cursor-pointer rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <InspirationPane />
                  </button>
                </aside>
              ) : (
                /* Right gutter. Mirrors the left one so the column lands dead
                   centre, and carries the wand only when there is something to
                   bring back — large and barely tinted at rest so it reads as a
                   quiet affordance beside the story rather than competing with
                   it, with the ICON lighting up on hover (a button plate out
                   here would look like a stray control floating in the margin). */
                <div className="hidden flex-1 items-center justify-center md:flex">
                  {hasInspiration ? (
                    <button
                      type="button"
                      onClick={() => setInspirationOpen(true)}
                      aria-expanded={false}
                      aria-label={t.game.inspirationShow}
                      className="focus-visible:ring-ring group cursor-pointer rounded-2xl p-4 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Wand2
                        className="text-muted-foreground/25 group-hover:text-primary size-24 transition-colors"
                        aria-hidden
                      />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
              <ScreenContent
                screen={screen}
                story={currentStory}
                storyMissing={storyMissing}
                settings={engine.settings}
                onChangeSettings={engine.setSettings}
                onStart={startWriting}
                settingsOpen={settingsOpen}
                onToggleSettings={toggleSettingsPanel}
                gridMode={gridMode}
                onToggleGridMode={() =>
                  setGridMode((m) => (m === "system" ? "custom" : "system"))
                }
                showcaseFace={showcaseFace}
                onChangeShowcaseFace={setShowcaseFace}
                stories={stories}
                storiesError={storiesError}
                storiesTotal={storiesTotal}
                storiesHasMore={storiesHasMore}
                storiesLoadingMore={storiesLoadingMore}
                onLoadMoreStories={() => void loadMoreStories()}
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
      {/* Ended: the story is finished but still editable, so this is where it
          gets named. Sits between the HUD and the text, pushing the editor down
          — a shift the player never sees mid-flow, since the results modal is
          over it when the state changes. */}
      {engine.gameState === "ended" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="story-title" className="text-sm font-semibold">
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

// ---- Non-split screens (landing / detail subsections / profile / story) --

function ScreenContent({
  screen,
  story,
  storyMissing,
  settings,
  onChangeSettings,
  onStart,
  settingsOpen,
  onToggleSettings,
  gridMode,
  onToggleGridMode,
  showcaseFace,
  onChangeShowcaseFace,
  stories,
  storiesError,
  storiesTotal,
  storiesHasMore,
  storiesLoadingMore,
  onLoadMoreStories,
  onShowSection,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
  onBackHome,
  onBackToStories,
}: {
  screen: Screen
  /** The record behind a `story` screen, resolved by the parent (which shares
   *  the verdict with the header). `null` while loading or when missing. */
  story: Story | null
  storyMissing: boolean
  settings: GameSettings
  onChangeSettings: (settings: GameSettings) => void
  onStart: () => void
  settingsOpen: boolean
  onToggleSettings: () => void
  gridMode: GridMode
  onToggleGridMode: () => void
  showcaseFace: ShowcaseFace
  onChangeShowcaseFace: (face: ShowcaseFace) => void
  stories: Story[] | null
  storiesError: boolean
  storiesTotal: number | null
  storiesHasMore: boolean
  storiesLoadingMore: boolean
  onLoadMoreStories: () => void
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
          showcaseFace={showcaseFace}
          onChangeShowcaseFace={onChangeShowcaseFace}
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
        <ContentColumn className="gap-5">
          <SectionDetail
            section={screen.section}
            stories={stories}
            storiesError={storiesError}
            storiesTotal={storiesTotal}
            storiesHasMore={storiesHasMore}
            storiesLoadingMore={storiesLoadingMore}
            onLoadMoreStories={onLoadMoreStories}
            onViewStory={onViewStory}
            onDeleteStory={onDeleteStory}
            onUpdateStoryTitle={onUpdateStoryTitle}
          />
        </ContentColumn>
      )
    case "profile":
      return (
        <ContentColumn className="gap-5">
          <ProfilePanel />
        </ContentColumn>
      )
    case "story":
      // The title and the back arrow are in the header; here it is just the
      // spinner, the not-found body, or the read-only story.
      if (story === null && !storyMissing) {
        return (
          <ContentColumn className="gap-5">
            <div role="status" aria-live="polite" className="flex justify-center py-16">
              <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
            </div>
          </ContentColumn>
        )
      }
      if (story === null) return <NotFoundBody onBack={onBackToStories} label={t.nav.backToStories} />
      return (
        <ContentColumn className="gap-5">
          <div className="h-[65vh]">
            <WritingArea value={story.text} onChange={() => {}} matches={[]} readOnly />
          </div>
        </ContentColumn>
      )
    case "notfound":
      return <NotFoundBody onBack={onBackHome} label={t.notFound.backHome} />
  }
}

// Client-rendered not-found screen (no server 404 — the shell is served for
// every app path). Reached for an unknown URL or a story id that doesn't
// resolve; its title and back arrow are in the header, and this button shares
// the arrow's destination, so both are labelled after where they lead.
function NotFoundBody({ onBack, label }: { onBack: () => void; label: string }) {
  const t = useTranslations()
  return (
    <ContentColumn className="gap-5">
      <div className="flex flex-col items-start gap-4 py-8">
        <p className="text-muted-foreground">{t.notFound.body}</p>
        <Button type="button" variant="outline" onClick={onBack}>
          {label}
        </Button>
      </div>
    </ContentColumn>
  )
}

function SectionDetail({
  section,
  stories,
  storiesError,
  storiesTotal,
  storiesHasMore,
  storiesLoadingMore,
  onLoadMoreStories,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
}: {
  section: Section
  stories: Story[] | null
  storiesError: boolean
  storiesTotal: number | null
  storiesHasMore: boolean
  storiesLoadingMore: boolean
  onLoadMoreStories: () => void
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
          total={storiesTotal}
          hasMore={storiesHasMore}
          loadingMore={storiesLoadingMore}
          onLoadMore={onLoadMoreStories}
          onViewStory={onViewStory}
          onDeleteStory={onDeleteStory}
          onUpdateTitle={onUpdateStoryTitle}
        />
      )
    case "progress":
      return <ProgressSection />
  }
}
