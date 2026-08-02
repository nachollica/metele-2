// Section identifiers for the dashboard's expanded subsections. Reached from
// the landing "Show all" links (the left sidebar was removed), so there is no
// nav-item list any more — just the union of detail screens. Kept framework
// -light (no JSX) so the shell, tests, and game wiring can all import it.

import { BarChart3, BookOpen, Zap, type LucideIcon } from "lucide-react"

import type { Translations } from "@/lib/i18n"

// Expanded subsections. "home" is the landing dashboard (not a subsection);
// "profile" is reached from the account menu; session settings live on the
// configuring screen — none of those are here. Achievements has no section of
// its own: it was merged into the expanded Challenges screen.
export type Section = "stories" | "challenges" | "stats"

// Icon + localized title for each expanded subsection, used by the detail
// screen header and (via the section's own preview card) the landing.
export const SECTION_META: Record<Section, { icon: LucideIcon; title: (t: Translations) => string }> = {
  stories: { icon: BookOpen, title: (t) => t.nav.stories },
  challenges: { icon: Zap, title: (t) => t.nav.challenges },
  stats: { icon: BarChart3, title: (t) => t.nav.stats },
}
