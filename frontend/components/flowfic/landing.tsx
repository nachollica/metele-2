"use client"

import { type GameSettings } from "@/lib/flowfic/types"
import { type Story } from "@/lib/flowfic/stories-api"

import { type Section } from "./dashboard-nav"
import { ContentColumn, Panel } from "./dashboard-widgets"
import { type GridMode } from "./preset-grid"
import { InspirationCard } from "./inspiration-panel"
import { SessionLauncher } from "./session-launcher"
import { SettingsPanel } from "./settings-panel"
import { StoriesSection } from "./stories-section"

// Landing order: the session launcher (dial + modes + actions), the advanced
// settings when "More options" is on, a fixed-height recent-stories panel, then
// the full-width inspiration card.

// Height of the recent-stories panel. Its rows divide this box and nothing
// inside it scrolls (see StoriesSection's preview).
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

      {/* Advanced settings: shown or hidden by "More options" rather than
          swapped with anything, so the panel is free to be exactly as tall as
          the settings it holds — the one place the landing's height moves.
          Desktop-only (see SessionLauncher), so on a phone `/new` just renders
          the normal home screen and needs no redirect. */}
      {settingsOpen ? (
        <Panel className="hidden md:block">
          <SettingsPanel settings={settings} onChange={onChangeSettings} />
        </Panel>
      ) : null}

      {/* Recent stories. Fixed height and deliberately NOT scrollable — the
          rows are sized to fill it exactly. */}
      <div
        className={`bg-card text-card-foreground ${PANEL_HEIGHT} flex flex-col overflow-hidden rounded-2xl border p-5 shadow-sm`}
      >
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

      <InspirationCard />
    </ContentColumn>
  )
}
