"use client"

// Small presentational building blocks shared across the dashboard sections.
// All copy is passed in already-localized so these stay dumb and testable.

import { type ReactNode } from "react"
import { ChevronRight, Check, CircleCheckBig, Trophy, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { OVERLINE, SECTION_TITLE } from "@/lib/text-styles"
import { TONE_BAR, TONE_CHIP, type Tone } from "@/lib/flowfic/gamification"

// The muted → accent ghost styling for a soft action sitting in a section
// header. Used by the "Show all" links; kept as a token so a second header
// action lands on the same treatment rather than inventing one.
export const HEADER_ACTION_CLASS = "text-muted-foreground hover:text-accent-foreground"

// ---- Icon chip ------------------------------------------------------------

export function IconChip({
  icon: Icon,
  tone,
  className,
  iconClassName,
  label,
}: {
  icon: LucideIcon
  tone: Tone
  className?: string
  iconClassName?: string
  /** Names the chip when it stands alone (an achievement badge in a row of
   *  them) rather than decorating labelled text beside it. Doubles as the
   *  hover tooltip, so the badge is identifiable by pointer and by screen
   *  reader alike. */
  label?: string
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        TONE_CHIP[tone],
        className,
      )}
      role={label ? "img" : undefined}
      aria-label={label}
      title={label}
    >
      <Icon className={cn("size-5", iconClassName)} aria-hidden />
    </div>
  )
}

// ---- Progress meter -------------------------------------------------------

export function ProgressMeter({
  value,
  tone = "green",
  className,
  label,
}: {
  /** 0–1 fraction. */
  value: number
  tone?: Tone
  className?: string
  /** Accessible name for the bar. */
  label?: string
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div
      className={cn("bg-muted h-1.5 w-full overflow-hidden rounded-full", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", TONE_BAR[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ---- Section card + header ------------------------------------------------

export function Panel({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-card text-card-foreground rounded-2xl border p-5 shadow-sm", className)}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Title row for a card or section: an `h2` plus an optional trailing action.
 *
 * `h2` and not `h3` — the page's `h1` is the screen title in the app header, so
 * cards sit directly under it with no level to skip. `description` renders a
 * muted sub-line for cards that need one.
 */
export function SectionHeader({
  title,
  description,
  action,
  id,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Set when the section labels itself via `aria-labelledby`. */
  id?: string
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={id} className={cn(SECTION_TITLE, "min-w-0 truncate")}>
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/**
 * The one centred content measure shared by the landing, the detail screens,
 * and the in-game writing column — so a story reads at the same width wherever
 * it appears, and the game area lands exactly where the home screen was.
 */
export function ContentColumn({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("mx-auto flex w-full max-w-5xl flex-col", className)}>{children}</div>
}

/**
 * Small "overline" label for a block nested inside a larger card — the merged
 * progress card uses it to keep the "Challenge of the day" / "Weekly summary"
 * labels visible now that they are no longer card titles of their own. Smaller
 * and lighter than `SectionHeader` so it reads as a sub-label, not a heading.
 */
export function CardSubtitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn(OVERLINE, "mb-2", className)}>{children}</div>
}

// ---- Empty / sign-in hint -------------------------------------------------

/**
 * Muted, centered hint shown in place of section content (empty lists, "sign in
 * to see…"). One place for the shared styling; callers tune the vertical padding
 * via `className` (tighter in preview cards, roomier on full screens).
 */
export function EmptyHint({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn("text-muted-foreground py-12 text-center text-sm", className)}>{children}</p>
  )
}

// ---- Level badge ----------------------------------------------------------

/**
 * Compact level chip — the same amber Trophy tone the home level tile uses, in a
 * small pill for tight spots like the account menu. `label` is the localized
 * word (e.g. "Level").
 */
export function LevelBadge({
  level,
  label,
  className,
}: {
  level: number
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
        TONE_CHIP.amber,
        className,
      )}
    >
      <Trophy className="size-3.5" aria-hidden />
      {label} {level}
    </span>
  )
}

// ---- "Show all" link ------------------------------------------------------

/**
 * Compact section-header action on the landing dashboard that opens the matching
 * expanded subsection. Uses the shared Button (ghost) so it matches every other
 * control while staying soft/borderless. `label` is the localized "Show all"
 * copy; `sectionName` names the target so screen readers get a unique name.
 * Disabled for anonymous users (the detail screens need an account).
 */
export function ShowAllButton({
  label,
  sectionName,
  onClick,
  disabled = false,
}: {
  label: string
  sectionName: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label}: ${sectionName}`}
      className={cn(HEADER_ACTION_CLASS, "disabled:opacity-40")}
    >
      {label}
      <ChevronRight className="size-3.5" aria-hidden />
    </Button>
  )
}

// ---- Stat tile ------------------------------------------------------------

/** Tile sizes, smallest first. The scale is what ranks the figures on a screen
 *  that shows several at once: "lg" is for the headline pair a section is built
 *  around, "sm" for a row packed into a short box. */
const STAT_TILE_SIZE = {
  sm: { chip: "size-9", icon: "size-4", value: "text-xl", label: "text-xs" },
  md: { chip: "size-11", icon: "size-5", value: "text-2xl", label: "text-sm" },
  // "lg" eases off on a phone: at full size the pair plus its progress bar
  // outgrew the box they share there. It stays the largest step at every width.
  lg: {
    chip: "size-12 sm:size-14",
    icon: "size-6 sm:size-7",
    value: "text-3xl sm:text-4xl",
    label: "text-sm",
  },
} as const

export type StatTileSize = keyof typeof STAT_TILE_SIZE

export function StatTile({
  icon: Icon,
  tone = "green",
  value,
  label,
  delta,
  deltaPositive,
  size = "md",
}: {
  icon?: LucideIcon
  tone?: Tone
  value: string
  label: string
  delta?: string | null
  deltaPositive?: boolean
  size?: StatTileSize
}) {
  const s = STAT_TILE_SIZE[size]
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      {Icon ? (
        <IconChip icon={Icon} tone={tone} className={cn("mb-1", s.chip)} iconClassName={s.icon} />
      ) : null}
      <div className="flex items-baseline gap-1">
        <span className={cn("font-extrabold tabular-nums", s.value)}>{value}</span>
        {delta ? (
          <span
            className={cn(
              "text-xs font-semibold",
              deltaPositive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <span className={cn("text-muted-foreground", s.label)}>{label}</span>
    </div>
  )
}

// ---- Achievement item -----------------------------------------------------

export function AchievementItem({
  icon,
  tone,
  name,
  description,
  unlocked,
  current,
  target,
  progress,
  showProgress = false,
}: {
  icon: LucideIcon
  tone: Tone
  name: string
  description: string
  unlocked: boolean
  current: number
  target: number
  progress: number
  showProgress?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <IconChip icon={icon} tone={tone} className="size-11" iconClassName="size-6" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold">{name}</div>
        <div className="text-muted-foreground truncate text-sm">{description}</div>
        {showProgress && !unlocked ? (
          <ProgressMeter value={progress} tone={tone} label={name} className="mt-2" />
        ) : null}
      </div>
      {unlocked ? (
        <div className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
          <Check className="size-4" aria-hidden />
        </div>
      ) : (
        <div className="bg-secondary text-secondary-foreground shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums">
          {current}/{target}
        </div>
      )}
    </div>
  )
}

// ---- Challenge card -------------------------------------------------------

export function ChallengeItem({
  icon,
  tone,
  name,
  description,
  progress,
  completed,
  progressLabel,
  completedLabel,
  action,
}: {
  icon: LucideIcon
  tone: Tone
  name: string
  description: string
  progress: number
  completed: boolean
  /** e.g. "250/600". */
  progressLabel: string
  /** Shown in place of the action once the challenge is met. */
  completedLabel: string
  action?: ReactNode
}) {
  return (
    <div className="bg-muted/40 flex flex-col rounded-xl border p-4">
      <div className="mb-2 flex items-center gap-2">
        <IconChip icon={icon} tone={tone} className="size-10" iconClassName="size-5" />
        <div className="text-base font-bold">{name}</div>
      </div>
      <p className="text-muted-foreground mb-3 text-sm leading-relaxed">{description}</p>
      <ProgressMeter value={progress} tone={tone} label={name} />
      <div className="text-muted-foreground mt-1.5 mb-3 text-xs tabular-nums">{progressLabel}</div>
      <div className="mt-auto">
        {completed ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CircleCheckBig className="size-4" aria-hidden />
            {completedLabel}
          </span>
        ) : (
          action
        )}
      </div>
    </div>
  )
}
