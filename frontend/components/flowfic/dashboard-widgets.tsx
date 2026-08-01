"use client"

// Small presentational building blocks shared across the dashboard sections.
// All copy is passed in already-localized so these stay dumb and testable.

import { type ReactNode } from "react"
import { ChevronRight, Check, CircleCheckBig, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { TONE_BAR, TONE_CHIP, type Tone } from "@/lib/flowfic/gamification"

// ---- Icon chip ------------------------------------------------------------

export function IconChip({
  icon: Icon,
  tone,
  className,
  iconClassName,
}: {
  icon: LucideIcon
  tone: Tone
  className?: string
  iconClassName?: string
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        TONE_CHIP[tone],
        className,
      )}
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

export function SectionHeader({
  title,
  action,
}: {
  title: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-lg font-bold">{title}</h3>
      {action}
    </div>
  )
}

// ---- "Show all" link ------------------------------------------------------

/**
 * Compact link used as a section-header action on the landing dashboard. Opens
 * the matching expanded subsection. `label` is the fully-localized "Show all"
 * copy; `sectionName` names the target so screen readers get a unique name.
 */
export function ShowAllButton({
  label,
  sectionName,
  onClick,
}: {
  label: string
  sectionName: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${sectionName}`}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex shrink-0 items-center gap-1 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {label}
      <ChevronRight className="size-4" aria-hidden />
    </button>
  )
}

// ---- Stat tile ------------------------------------------------------------

export function StatTile({
  icon: Icon,
  tone = "green",
  value,
  label,
  delta,
  deltaPositive,
}: {
  icon?: LucideIcon
  tone?: Tone
  value: string
  label: string
  delta?: string | null
  deltaPositive?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      {Icon ? <IconChip icon={Icon} tone={tone} className="mb-1 size-11" iconClassName="size-5" /> : null}
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-extrabold tabular-nums">{value}</span>
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
      <span className="text-muted-foreground text-sm">{label}</span>
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

// ---- Quote card -----------------------------------------------------------

export function QuoteCard({ quote }: { quote: string }) {
  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <span
        aria-hidden
        className="font-serif text-3xl leading-none text-amber-500 dark:text-amber-400"
      >
        &ldquo;
      </span>
      <p className="mt-1 text-sm font-medium leading-relaxed text-amber-950 dark:text-amber-100">
        {quote}
      </p>
      <div className="bg-primary mt-3 h-0.5 w-10 rounded-full" />
    </div>
  )
}
