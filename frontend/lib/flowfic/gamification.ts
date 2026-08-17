// Gamification wire types + presentational metadata for the dashboard.
//
// The backend (`app/gamification.py`) computes every number from the user's
// stories and returns ids + values only. This module mirrors those wire shapes
// and owns the *display* half the backend deliberately omits: which icon/tone
// each achievement and challenge wears, the deterministic daily-prompt picker,
// and small formatting helpers. Achievement/challenge *names* and descriptions
// live in the i18n dictionaries, keyed by the same ids.

import {
  BookOpen,
  CalendarCheck,
  Castle,
  Clock,
  Compass,
  Feather,
  Flame,
  Footprints,
  Ghost,
  Moon,
  Mountain,
  PenLine,
  Rocket,
  Sparkles,
  Sunrise,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type { Locale, Translations } from "@/lib/i18n"

// ---- Wire shapes (mirror the Pydantic models in app/gamification.py) ------

export type LevelInfo = {
  level: number
  totalXp: number
  xpIntoLevel: number
  xpForLevel: number
}

export type ChartPoint = {
  /** ISO `YYYY-MM-DD` in the requested timezone. */
  date: string
  words: number
}

export type WeeklySummary = {
  sessions: number
  words: number
  durationMs: number
  /** Percentage change vs. the previous week, or null with no baseline. */
  deltaSessions: number | null
  deltaWords: number | null
  deltaDurationMs: number | null
}

export type Overview = {
  streak: number
  totalSessions: number
  totalWords: number
  totalDurationMs: number
  level: LevelInfo
  weekly: WeeklySummary
  chart: ChartPoint[]
}

export type Achievement = {
  id: string
  unlocked: boolean
  current: number
  target: number
  /** 0–1 ratio for the progress bar. */
  progress: number
}

export type Challenge = {
  id: string
  current: number
  target: number
  progress: number
  completed: boolean
}

// ---- Empty states ---------------------------------------------------------
// Anonymous users (and the first authenticated tick) have no data; these keep
// every numeric card rendering clean zeros instead of blank/NaN.

export const EMPTY_LEVEL: LevelInfo = {
  level: 1,
  totalXp: 0,
  xpIntoLevel: 0,
  xpForLevel: 300,
}

/** A 7-day, all-zero series ending today so the chart still draws a baseline. */
export function zeroWeek(days = 7): ChartPoint[] {
  const now = new Date()
  const out: ChartPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`
    out.push({ date: iso, words: 0 })
  }
  return out
}

export function emptyOverview(): Overview {
  return {
    streak: 0,
    totalSessions: 0,
    totalWords: 0,
    totalDurationMs: 0,
    level: EMPTY_LEVEL,
    weekly: {
      sessions: 0,
      words: 0,
      durationMs: 0,
      deltaSessions: null,
      deltaWords: null,
      deltaDurationMs: null,
    },
    chart: zeroWeek(),
  }
}

// ---- Tones ----------------------------------------------------------------
// A small fixed palette so every accented chip/badge reads as one system in
// both light and dark. Each tone is a soft fill plus a readable foreground.

export type Tone =
  | "amber"
  | "orange"
  | "red"
  | "green"
  | "violet"
  | "blue"
  | "indigo"

export const TONE_CHIP: Record<Tone, string> = {
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  orange: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  indigo: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
}

/** The same palette as text, for the places that colour a word or a figure
 *  rather than a chip or a bar — a week-on-week gain, a "completed" line. Third
 *  copies of `green`'s pair were written out by hand before this existed. */
export const TONE_TEXT: Record<Tone, string> = {
  amber: "text-amber-600 dark:text-amber-400",
  orange: "text-orange-600 dark:text-orange-400",
  red: "text-red-600 dark:text-red-400",
  green: "text-emerald-600 dark:text-emerald-400",
  violet: "text-violet-600 dark:text-violet-400",
  blue: "text-blue-600 dark:text-blue-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
}

export const TONE_BAR: Record<Tone, string> = {
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  green: "bg-emerald-500",
  violet: "bg-violet-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
}

// ---- Achievements / challenges visual metadata ----------------------------

type Visual = { icon: LucideIcon; tone: Tone }

// Fixed display order matches the backend's ACHIEVEMENT_IDS. Unknown ids
// (older/newer backend) fall back to a neutral icon rather than crashing.
export const ACHIEVEMENT_VISUALS: Record<string, Visual> = {
  first_session: { icon: Footprints, tone: "amber" },
  streak_7: { icon: Flame, tone: "orange" },
  streak_30: { icon: Flame, tone: "red" },
  wordsmith: { icon: PenLine, tone: "green" },
  marathon: { icon: Clock, tone: "violet" },
  big_session: { icon: Zap, tone: "blue" },
  night_owl: { icon: Moon, tone: "indigo" },
  early_bird: { icon: Sunrise, tone: "amber" },
}

export const CHALLENGE_VISUALS: Record<string, Visual> = {
  daily_600: { icon: Zap, tone: "violet" },
  weekly_5_sessions: { icon: CalendarCheck, tone: "green" },
  keep_streak: { icon: Flame, tone: "orange" },
}

const FALLBACK_VISUAL: Visual = { icon: Sparkles, tone: "green" }

export function achievementVisual(id: string): Visual {
  return ACHIEVEMENT_VISUALS[id] ?? FALLBACK_VISUAL
}

export function challengeVisual(id: string): Visual {
  return CHALLENGE_VISUALS[id] ?? FALLBACK_VISUAL
}

// Localized name/description for an achievement or challenge id. The i18n
// dictionaries key these objects by the same ids the backend emits, but their
// literal `as const` types aren't string-indexable, so look up through a
// widened record and fall back to the raw id for an unknown key.
type NamedText = { name: string; description: string }

export function achievementText(t: Translations, id: string): NamedText {
  const items = t.achievements.items as Record<string, NamedText>
  return items[id] ?? { name: id, description: "" }
}

export function challengeText(t: Translations, id: string): NamedText {
  const items = t.challenges.items as Record<string, NamedText>
  return items[id] ?? { name: id, description: "" }
}

// ---- Story cover derivation -----------------------------------------------
// Our stories carry no icon; we deterministically assign one from the id so a
// story always shows the same cover. Titles are derived from the text when the
// (currently unused) title column is null.

const STORY_ICONS: Visual[] = [
  { icon: Mountain, tone: "green" },
  { icon: Rocket, tone: "violet" },
  { icon: Castle, tone: "orange" },
  { icon: Compass, tone: "blue" },
  { icon: Feather, tone: "amber" },
  { icon: BookOpen, tone: "indigo" },
  { icon: Ghost, tone: "red" },
  { icon: Wand2, tone: "violet" },
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function storyVisual(seed: number | string): Visual {
  const n = typeof seed === "number" ? Math.abs(seed) : hashString(seed)
  return STORY_ICONS[n % STORY_ICONS.length]
}

const TITLE_MAX_CHARS = 48
const TITLE_MAX_WORDS = 6

/**
 * Derive a friendly title from the story text: the first clause (up to a
 * sentence break) trimmed to a few words. Falls back to the provided label for
 * empty text. Used only when the story has no explicit title.
 */
export function deriveTitle(text: string, fallback: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim()
  if (!collapsed) return fallback
  const sentenceEnd = collapsed.search(/[.!?]/)
  const clause =
    sentenceEnd > 0 && sentenceEnd < 60 ? collapsed.slice(0, sentenceEnd) : collapsed
  const words = clause.split(" ").slice(0, TITLE_MAX_WORDS).join(" ")
  return words.length > TITLE_MAX_CHARS
    ? `${words.slice(0, TITLE_MAX_CHARS).trimEnd()}…`
    : words
}

// ---- Daily rotation -------------------------------------------------------

/** 1-based day of the year, used to rotate daily content deterministically. */
export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000)
}

/** Pick today's index into a pool (stable across a day). Used by the quote of
 * the day and the featured challenge. */
export function dailyIndex(poolLength: number, d: Date = new Date()): number {
  if (poolLength <= 0) return 0
  return dayOfYear(d) % poolLength
}

// ---- Formatting -----------------------------------------------------------

function bcp47(locale: Locale): string {
  return locale === "es" ? "es-ES" : "en-US"
}

/** Localized thousands grouping: `3.250` (es) / `3,250` (en). */
export function formatCount(n: number, locale: Locale): string {
  return new Intl.NumberFormat(bcp47(locale)).format(n)
}

/** Compact writing time: `6h 15m`, or `15m` under an hour. */
export function formatHoursMinutes(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

/**
 * Signed, rounded percentage delta (`+12%`), or null when there is nothing worth
 * saying.
 *
 * Three cases produce no delta. `null` in means the backend had no baseline to
 * compare against (last week was zero — see `_pct_delta` in gamification.py), so
 * any percentage would be a division by nothing. A delta that rounds to zero
 * means "same as last week": rendering `+0%` next to an up arrow claims progress
 * that did not happen, and the absent indicator says "unchanged" better than a
 * zero does. And exactly `-100%` means the week went to nothing — the figure
 * beside it is already `0`, so the percentage adds no information and only
 * lands a red mark on the worst week someone could be having.
 */
export function formatDelta(pct: number | null): string | null {
  if (pct === null) return null
  const rounded = Math.round(pct)
  if (rounded === 0 || rounded === -100) return null
  return `${rounded > 0 ? "+" : ""}${rounded}%`
}

/** Whether a delta should read as positive (green) vs negative (muted/red). */
export function deltaIsPositive(pct: number | null): boolean {
  return pct !== null && pct >= 0
}
