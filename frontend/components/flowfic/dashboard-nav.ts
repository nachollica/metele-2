// Section identifiers + sidebar navigation config for the dashboard.
// Kept framework-light (no JSX) so it can be imported by the shell, the tests,
// and the game engine wiring alike.

import {
  BarChart3,
  BookOpen,
  Home,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type { Translations } from "@/lib/i18n"

// Main nav sections. "profile" is intentionally not here — it's reached from
// the account menu, not the primary nav. Session settings live on the Home
// screen, so there is no dedicated "settings" section either.
export type Section =
  | "home"
  | "stories"
  | "challenges"
  | "stats"
  | "achievements"

export type NavItem = {
  id: Section
  icon: LucideIcon
  /** Resolver for the localized label (keeps this file JSX/context-free). */
  label: (t: Translations) => string
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", icon: Home, label: (t) => t.nav.home },
  { id: "stories", icon: BookOpen, label: (t) => t.nav.stories },
  { id: "challenges", icon: Zap, label: (t) => t.nav.challenges },
  { id: "stats", icon: BarChart3, label: (t) => t.nav.stats },
  { id: "achievements", icon: Trophy, label: (t) => t.nav.achievements },
] as const
