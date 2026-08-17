"use client"

import { type GameSettings } from "@/lib/flowfic/types"
import { type Story } from "@/lib/flowfic/stories-api"

import { type Section } from "./dashboard-nav"
import { ContentColumn, Panel } from "./dashboard-widgets"
import { LandingShowcase, type ShowcaseFace } from "./landing-showcase"
import { type GridMode } from "./preset-grid"
import { SessionLauncher } from "./session-launcher"
import { SettingsPanel } from "./settings-panel"

// Landing order: the session launcher (dial + modes + actions), the advanced
// settings when "More options" is on, then the showcase — three circular
// selectors over one pane holding whichever they pick.
//
// Every box below the launcher has a fixed shape, so the landing's height is
// the same whatever the player is looking at. The settings panel is the single
// deliberate exception: it is sized by its own content and moves the page when
// it appears.

type Props = {
  settings: GameSettings
  onChangeSettings: (settings: GameSettings) => void
  /** Begin the sprint with the current settings. */
  onStart: () => void
  /** Whether the advanced settings are shown (URL-backed: /new). */
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
  /** Showcase face, lifted for the same reason plus a trip into a detail screen. */
  showcaseFace: ShowcaseFace
  onChangeShowcaseFace: (face: ShowcaseFace) => void
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
  showcaseFace,
  onChangeShowcaseFace,
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
          the settings it holds. Desktop-only (see SessionLauncher), so on a
          phone `/new` just renders the normal home screen and needs no
          redirect. */}
      {settingsOpen ? (
        <Panel className="hidden md:block">
          <SettingsPanel settings={settings} onChange={onChangeSettings} />
        </Panel>
      ) : null}

      <LandingShowcase
        face={showcaseFace}
        onChangeFace={onChangeShowcaseFace}
        onShowSection={onShowSection}
        stories={stories}
        storiesError={storiesError}
        onViewStory={onViewStory}
        onDeleteStory={onDeleteStory}
        onUpdateStoryTitle={onUpdateStoryTitle}
      />
    </ContentColumn>
  )
}
