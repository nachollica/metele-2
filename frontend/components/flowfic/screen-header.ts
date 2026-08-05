// Title + back-arrow for the app header, derived from the visible screen.
//
// The header's centre column names the screen, so every screen's title and the
// destination of its back arrow are decided here rather than by each screen's
// own chrome — there is only one bar to fill, and `dashboard.tsx` is the only
// place that knows which screen is up.
//
// Kept framework-light (no JSX / React) so the shell and its unit tests can
// import the pure mapping.

import type { Translations } from "@/lib/i18n"

import { SECTION_META } from "./dashboard-nav"
import type { Screen } from "./navigation"

// Where the back arrow leads. `null` means the screen shows no arrow (the
// landing is the root of the in-app tree).
export type BackTarget = "home" | "stories" | null

export type ScreenHeader = {
  title: string
  backTo: BackTarget
  /** Accessible name for the arrow; matches where it leads. */
  backLabel: string | null
}

export function screenHeader(
  screen: Screen,
  t: Translations,
  // A story id that doesn't resolve renders the not-found screen, so the header
  // has to agree with it. `false` while the stories list is still loading.
  { storyMissing = false }: { storyMissing?: boolean } = {},
): ScreenHeader {
  switch (screen.name) {
    // `landing` and `configuring` are the same screen (the latter just has the
    // advanced-settings panel open), and it is the root — no arrow.
    case "landing":
    case "configuring":
      return { title: t.nav.createStory, backTo: null, backLabel: null }
    case "section":
      return {
        title: SECTION_META[screen.section].title(t),
        backTo: "home",
        backLabel: t.nav.backToHome,
      }
    case "profile":
      return { title: t.profile.title, backTo: "home", backLabel: t.nav.backToHome }
    // Both a story and a not-found reached from one return to the stories list.
    case "story":
      return {
        title: storyMissing ? t.notFound.title : t.game.viewingStory,
        backTo: "stories",
        backLabel: t.nav.backToStories,
      }
    case "notfound":
      return { title: t.notFound.title, backTo: "home", backLabel: t.nav.backToHome }
  }
}
