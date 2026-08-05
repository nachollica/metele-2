"use client"

import { useTranslations } from "@/lib/i18n"
import { type GameSettings } from "@/lib/flowfic/types"
import { type Story } from "@/lib/flowfic/stories-api"

import { type Section } from "./dashboard-nav"
import { type GridMode } from "./preset-grid"
import { InspirationCard } from "./inspiration-panel"
import { SessionLauncher } from "./session-launcher"
import { SettingsPanel } from "./settings-panel"
import { StoriesSection } from "./stories-section"

// Landing order: the session launcher (dial + modes + actions), a fixed-height
// panel that swaps between recent stories and the advanced settings, then the
// full-width inspiration card.

// Height of the swappable panel. Sized so the settings face fits without the
// container resizing when the two faces trade places — the stories face simply
// shows as many rows as fit and scrolls for the rest.
const PANEL_HEIGHT = "h-[30rem]"

type Props = {
  settings: GameSettings
  onChangeSettings: (settings: GameSettings) => void
  /** Begin the sprint with the current settings. */
  onStart: () => void
  /** Whether the swappable panel shows the settings face (URL-backed: /new). */
  settingsOpen: boolean
  onToggleSettings: () => void
  /** Open an expanded subsection (from a "Show all" link). */
  onShowSection: (section: Section) => void
  stories: Story[] | null
  storiesError: boolean
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateStoryTitle: (id: number, title: string | null) => Promise<boolean>
  /** Mode grid face, lifted here so it survives the panel toggling. */
  gridMode: GridMode
  onToggleGridMode: () => void
}

export function LandingHome({
  settings,
  onChangeSettings,
  onStart,
  settingsOpen,
  onToggleSettings,
  onShowSection,
  stories,
  storiesError,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
  gridMode,
  onToggleGridMode,
}: Props) {
  const t = useTranslations()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      {/* The landing has no visible title by design; this names the screen for
          assistive tech so the page still has a top-level heading. */}
      <h1 className="sr-only">{t.app.title}</h1>

      <SessionLauncher
        settings={settings}
        onChange={onChangeSettings}
        onStart={onStart}
        settingsOpen={settingsOpen}
        onToggleSettings={onToggleSettings}
        gridMode={gridMode}
        onToggleGridMode={onToggleGridMode}
      />

      {/* Swappable panel: recent stories by default, advanced settings behind
          "More options". Fixed height so toggling never jumps the page. */}
      <div
        className={`bg-card text-card-foreground ${PANEL_HEIGHT} overflow-y-auto rounded-2xl border p-5 shadow-sm`}
      >
        {settingsOpen ? (
          <SettingsPanel settings={settings} onChange={onChangeSettings} />
        ) : (
          <StoriesSection
            preview
            flush
            onShowAll={() => onShowSection("stories")}
            stories={stories}
            error={storiesError}
            onViewStory={onViewStory}
            onDeleteStory={onDeleteStory}
            onUpdateTitle={onUpdateStoryTitle}
          />
        )}
      </div>

      <InspirationCard />
    </div>
  )
}
