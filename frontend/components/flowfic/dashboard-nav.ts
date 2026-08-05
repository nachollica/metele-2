// Section identifiers for the dashboard's expanded subsections. Reached from
// the landing "Show all" links (the left sidebar was removed), so there is no
// nav-item list any more — just the union of detail screens. Kept framework
// -light (no JSX) so the shell, tests, and game wiring can all import it.

import { BookOpen, Compass, type LucideIcon } from "lucide-react"

import type { Translations } from "@/lib/i18n"

// Expanded subsections. Just two for signed-in users: "stories" (their saved
// stories) and "journey" — the merged progress screen that folds together the
// former Statistics, Challenges, and Achievements sections. "home" is the
// landing dashboard (not a subsection); "profile" is reached from the account
// menu; session settings live on the configuring screen — none are here.
export type Section = "stories" | "journey"

// Icon + localized title for each expanded subsection, used by the detail
// screen header, the landing's combined card, and the account-menu links.
export const SECTION_META: Record<Section, { icon: LucideIcon; title: (t: Translations) => string }> = {
  stories: { icon: BookOpen, title: (t) => t.nav.stories },
  journey: { icon: Compass, title: (t) => t.nav.journey },
}
