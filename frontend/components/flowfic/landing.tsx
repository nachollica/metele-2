"use client"

import { type GameSettings } from "@/lib/flowfic/types"
import { type Story } from "@/lib/flowfic/stories-api"

import { type Section } from "./dashboard-nav"
import { ContentColumn } from "./dashboard-widgets"
import { type GridMode } from "./preset-grid"
import { InspirationCard } from "./inspiration-panel"
import { SessionLauncher } from "./session-launcher"
import { SettingsPanel } from "./settings-panel"
import { StoriesSection } from "./stories-section"

// Landing order: the session launcher (dial + modes + actions), a fixed-height
// panel that swaps between recent stories and the advanced settings, then the
// full-width inspiration card.

// Height of the swappable panel. Sized so the settings face fits exactly —
// nothing inside it scrolls, and the stories face lays its three rows out to
// fill the same box (see StoriesSection's preview).
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
  return (
    <ContentColumn className="gap-6">
      {/* No heading here: the app header carries this screen's `h1`
          ("Create a story"), like every other screen. */}
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
          "More options". Fixed height so toggling never jumps the page, and
          deliberately NOT scrollable — each face is sized to fit it exactly.
          The settings face is desktop-only (see SessionLauncher), so on a phone
          this always shows the stories and `/new` needs no redirect. */}
      <div
        className={`bg-card text-card-foreground ${PANEL_HEIGHT} flex flex-col overflow-hidden rounded-2xl border p-5 shadow-sm`}
      >
        {settingsOpen ? (
          <div className="hidden min-h-0 flex-1 md:block">
            <SettingsPanel settings={settings} onChange={onChangeSettings} />
          </div>
        ) : null}
        <div className={settingsOpen ? "flex min-h-0 flex-1 flex-col md:hidden" : "flex min-h-0 flex-1 flex-col"}>
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
        </div>
      </div>

      <InspirationCard />
    </ContentColumn>
  )
}
