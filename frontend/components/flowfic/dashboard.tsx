"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Wand2 } from "lucide-react"

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
import { cn } from "@/lib/utils"

import { useAuth } from "@/lib/auth"
import { useBackendStatus } from "@/lib/backend"
import { useTranslations } from "@/lib/i18n"
import { useInspiration } from "@/lib/flowfic/inspiration"
import { useGameEngine } from "@/lib/flowfic/use-game-engine"
import { useStories } from "@/lib/flowfic/use-stories"
import type { Story } from "@/lib/flowfic/stories-api"

import { type Section } from "./dashboard-nav"
import { pathToScreen, screenToPath, type Screen } from "./navigation"
import { screenHeader } from "./screen-header"
import { ScreenAnnouncer } from "./screen-announcer"
import { AppHeader } from "./app-header"
import { ContentColumn } from "./dashboard-widgets"
import { GameArea, LoadingSplash } from "./game-area"
import { ScreenContent } from "./screen-content"
import { GamificationProvider } from "./gamification-context"
import { InspirationPane } from "./inspiration-panel"
import { type ShowcaseFace } from "./landing-showcase"
import { type GridMode } from "./preset-grid"
import { ResultsModal } from "./results-modal"
import { WelcomeModal } from "./welcome-modal"

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
  const screenTitle = splitLayout ? null : header.title

  // Park focus on the content region after a screen change. Without this, the
  // control that navigated is often gone — "Show all" unmounts with the section
  // it opened — and focus falls back to <body>, so the next Tab restarts from
  // the top of the page. Skipped on first paint (nothing was navigated to) and
  // during a sprint, where the editor autofocuses itself.
  const mainRef = useRef<HTMLElement | null>(null)
  const focusedScreenRef = useRef<string | null>(null)
  useEffect(() => {
    const key = screen.name === "section" ? `section:${screen.section}` : screen.name
    const isFirst = focusedScreenRef.current === null
    const changed = focusedScreenRef.current !== key
    focusedScreenRef.current = key
    if (isFirst || !changed || splitLayout) return
    mainRef.current?.focus()
  }, [screen, splitLayout])

  return (
    <GamificationProvider refreshKey={engine.storiesRefreshKey}>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <ScreenAnnouncer title={screenTitle} />
        {/* Off-screen until focused, then a real button in the top-left. Has to
            be the first focusable node in the tree, so it lives above the
            header rather than inside it. */}
        <a
          href="#main"
          onClick={(e) => {
            // The href is for AT semantics; a fragment jump would push a
            // history entry this SPA does not own, so move focus by hand.
            e.preventDefault()
            mainRef.current?.focus()
          }}
          className="bg-background text-foreground focus:ring-ring sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:not-sr-only focus:rounded-md focus:border focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:ring-2 focus:outline-none"
        >
          {t.app.skipToContent}
        </a>
        <AppHeader
          authStatus={authStatus}
          devUserEnabled={devUserEnabled}
          disabled={controlsDisabled}
          title={screenTitle}
          onBack={header.backTo !== null ? headerBack : undefined}
          backLabel={header.backLabel}
          onGoHome={goHome}
          onShowSection={showSection}
          onOpenProfile={openProfile}
        />

        {/* `tabIndex={-1}` so navigation can move focus here; it is never in the
            Tab order itself, and `outline-none` keeps the focus ring off a
            region the pointer user never asked to focus. */}
        <main id="main" ref={mainRef} tabIndex={-1} className="min-h-0 flex-1 outline-none">
          {/* The sprint suppresses the bar's title, which left the game screen
              with no h1 at all — the one screen a player spends real time on.
              Restored here for assistive tech only; on screen the HUD and the
              editor say plainly enough what this is. */}
          {splitLayout ? <h1 className="sr-only">{t.game.sprintHeading}</h1> : null}
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

              {/* The same `ContentColumn` the home screen uses, rather than a
                  second spelling of its cap and padding — that is what makes a
                  story read at one width wherever it appears. Beside an open
                  pane it also takes whatever the pane leaves; centred, it must
                  NOT be `flex-1`, or it would take a third of the row alongside
                  the two gutters instead of claiming the measure outright. */}
              <ContentColumn
                className={cn("min-w-0 gap-4 overflow-hidden", paneShown && "flex-1")}
              >
                {loading ? (
                  <LoadingSplash />
                ) : (
                  <GameArea engine={engine} onQuit={requestQuit} onFinish={finishStory} />
                )}
              </ContentColumn>

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
            /* The app's only scroll container, and the one place that decides
               what a screen IS: scroll pane + content column + gap. Each
               `ScreenContent` case used to spell that wrapper itself, which is
               how five of the six ended up with a `gap-5` that never applied
               (one child each) and the sixth with a different gap entirely. */
            <div className="h-full min-h-0 overflow-y-auto">
              <ContentColumn className="gap-6">
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
              </ContentColumn>
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
              variant="destructive"
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
