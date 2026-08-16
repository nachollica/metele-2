// Section identifiers for the dashboard's expanded subsections. Reached from
// the landing "Show all" links (the left sidebar was removed), so there is no
// nav-item list any more — just the union of detail screens. Kept framework
// -light (no JSX) so the shell, tests, and game wiring can all import it.

import { BookOpen, ChartLine, type LucideIcon } from "lucide-react"

import type { Translations } from "@/lib/i18n"

// Expanded subsections. Just two for signed-in users: "stories" (their saved
// stories) and "progress" — the merged screen that folds together the former
// Statistics, Challenges, and Achievements sections. "home" is the landing
// dashboard (not a subsection); "profile" is reached from the account menu;
// session settings live on the configuring screen — none are here.
export type Section = "stories" | "progress"

// Icon + localized title for each expanded subsection, used by the detail
// screen header, the landing's showcase, and the account-menu links.
export const SECTION_META: Record<Section, { icon: LucideIcon; title: (t: Translations) => string }> = {
  stories: { icon: BookOpen, title: (t) => t.nav.stories },
  progress: { icon: ChartLine, title: (t) => t.nav.progress },
}
