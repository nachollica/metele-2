// Section identifiers for the dashboard's expanded subsections. Reached from
// the landing "Show all" links (the left sidebar was removed), so there is no
// nav-item list any more — just the union of detail screens. Kept framework
// -light (no JSX) so the shell, tests, and game wiring can all import it.

import type { Translations } from "@/lib/i18n"

// Expanded subsections. Just two for signed-in users: "stories" (their saved
// stories) and "progress" — the merged screen that folds together the former
// Statistics, Challenges, and Achievements sections. "home" is the landing
// dashboard (not a subsection); "profile" is reached from the account menu;
// session settings live on the configuring screen — none are here.
export type Section = "stories" | "progress"

// Localized title for each expanded subsection. Read by `screen-header.ts`,
// which names the detail screen in the top bar — the one place a section's
// title is rendered. The showcase circles and the account-menu links carry
// their own copy and icons, since neither is titled after the section.
export const SECTION_META: Record<Section, { title: (t: Translations) => string }> = {
  stories: { title: (t) => t.nav.stories },
  progress: { title: (t) => t.nav.progress },
}
