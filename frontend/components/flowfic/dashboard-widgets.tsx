"use client"

// Small presentational building blocks shared across the dashboard sections.
// All copy is passed in already-localized so these stay dumb and testable.

import { type ReactNode } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Check,
  CircleCheckBig,
  Loader2,
  Trophy,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HINT, ITEM_TITLE, OVERLINE, SECTION_TITLE } from "@/lib/text-styles"
import { TONE_BAR, TONE_CHIP, TONE_TEXT, type Tone } from "@/lib/flowfic/gamification"

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

// ---- Spinner --------------------------------------------------------------

const SPINNER_SIZE = {
  /** Beside a label, inside a button or a line of text. */
  inline: "size-4",
  /** Standing in for a section's content while it loads. */
  block: "size-8",
  /** The whole screen is waiting. */
  page: "size-10",
} as const

/**
 * The app's loading spinner. Re-rolled at seven sites across four sizes and two
 * colours before this — which also meant seven chances to forget `aria-hidden`,
 * and seven classes the app-wide `prefers-reduced-motion` rule had to keep
 * matching by name.
 *
 * Always decorative: it is the *container* that carries `role="status"` and the
 * words, because a spinning icon with an accessible name announces a shape
 * rather than what is being waited for.
 */
export function Spinner({
  size = "block",
  className,
}: {
  size?: keyof typeof SPINNER_SIZE
  className?: string
}) {
  return (
    <Loader2
      className={cn("text-primary animate-spin", SPINNER_SIZE[size], className)}
      aria-hidden
    />
  )
}

// ---- Progress meter -------------------------------------------------------

/**
 * Fills for the app's one progress bar: the palette tones an achievement or a
 * challenge is coloured by, plus the two semantic ones a countdown needs. The
 * `Tone` union stays as it is — it describes the gamification palette, and a
 * timer running out is not a colour from that palette, it is `--destructive`.
 */
const METER_FILL = {
  ...TONE_BAR,
  primary: "bg-primary",
  destructive: "bg-destructive",
} as const

export type MeterTone = keyof typeof METER_FILL

/**
 * The app's only progress bar. The game HUD's timer bars used to be a second
 * definition of this, identical in DOM and ARIA and differing only in the three
 * things now expressed as props — so a change to the height or the radius had to
 * be made twice, and once wasn't.
 */
export function ProgressMeter({
  value,
  tone = "green",
  className,
  label,
  valueText,
  speed = "settled",
}: {
  /** 0–1 fraction. */
  value: number
  tone?: MeterTone
  className?: string
  /** Accessible name for the bar. */
  label?: string
  /**
   * What the bar's value should be *said* as, when a percentage is the wrong
   * unit — a countdown announced as "42 percent" is useless. `aria-valuetext`
   * takes precedence over the numeric value in every screen reader, so the
   * percentage stays as the machine-readable fallback.
   */
  valueText?: string
  /** `live` for a value that moves every tick (a countdown): a short, linear
   *  tween, since an eased half-second one never settles. */
  speed?: "settled" | "live"
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
      aria-valuetext={valueText}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          speed === "live" ? "duration-200 ease-linear" : "duration-500",
          METER_FILL[tone],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ---- Selectable card ------------------------------------------------------

/**
 * A card the player picks: a game mode, a custom-mode slot, a showcase circle.
 *
 * Written out five times before this, and one copy had already drifted — the "+"
 * add slot carried a different focus-ring width from the four cells beside it.
 * The variants are the two things that actually differ: the outline (a rounded
 * cell or a circle) and whether it is the current choice.
 *
 * Not used by the inline rename form, which wears the selected treatment while
 * being a form container rather than a control — it must not light up on hover.
 */
export const selectableCardVariants = cva(
  cn(
    "flex flex-col items-center justify-center border text-center transition-colors",
    "hover:bg-accent/20 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
  ),
  {
    variants: {
      shape: {
        cell: "rounded-xl p-3",
        /** A percentage inset, so the legend keeps clear of the curve at every
         *  size — a fixed one that looks right at 206px crowds the edge at 106. */
        circle: "aspect-square rounded-full p-[14%]",
      },
      state: {
        idle: "border-border bg-card",
        selected: "border-highlight bg-highlight/20 ring-highlight/30 ring-1",
        /** A slot that can be filled but is not a choice yet. */
        empty: "border-border border-dashed",
      },
    },
    defaultVariants: { shape: "cell", state: "idle" },
  },
)

// ---- Section card + header ------------------------------------------------

/**
 * The app's card surface, as one recipe.
 *
 * The split between what is fixed and what is a variant is deliberate:
 * **decoration is shared, layout is parameterised.** Radius, border, shadow and
 * background are the same everywhere — nine surfaces used to spell them across
 * three radii for one visual idea, and nothing was gained by the difference.
 * Padding is not, because it moves what is around it: the game HUD at `p-4` and
 * the profile card at `p-6` are different densities on purpose, and the panes
 * that hold a full-bleed image take none at all.
 *
 * Exported as `panelVariants` too, for the surfaces that are not a `<div>` — a
 * `<section>` with an `aria-label`, mostly. Same recipe, caller's tag.
 */
export const panelVariants = cva("bg-card text-card-foreground rounded-2xl border shadow-sm", {
  variants: {
    padding: {
      /** Full-bleed: the content reaches the border (an image, a chart pane). */
      none: "",
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
    },
  },
  defaultVariants: { padding: "md" },
})

export function Panel({
  children,
  className,
  padding,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof panelVariants>) {
  return (
    <div className={cn(panelVariants({ padding }), className)} {...rest}>
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
          <p className={HINT}>{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/**
 * The one centred content measure shared by the landing, the detail screens,
 * and the in-game writing column — so a story reads at the same width wherever
 * it appears.
 *
 * The padding is INSIDE the cap, and that is the load-bearing half. When the
 * scroll container held it instead, a centred screen rendered 1024px of content
 * and the in-game column — which has always padded inside its own cap — rendered
 * 976px, so the same story read at two widths depending on which screen it was
 * on. One element owning both numbers is what makes them agree; do not move the
 * padding back out to a caller.
 */
export function ContentColumn({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mx-auto flex w-full max-w-5xl flex-col p-4 sm:p-6", className)}>
      {children}
    </div>
  )
}

/**
 * Small "overline" title for a card nested inside a larger section — the
 * progress section uses it for "Weekly summary" and "Achievements". Smaller and
 * lighter than `SectionHeader` so it reads as a sub-label.
 *
 * An `h3` despite the size: it titles a real block, and the sections it sits in
 * are `h2`. Without it the progress screen jumped straight from the `h1` to the
 * `h4` on an achievement badge. Pass `id` and point the owning `<section>` at it
 * with `aria-labelledby`, so the name is not written twice.
 */
export function CardSubtitle({
  children,
  className,
  id,
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <h3 id={id} className={cn(OVERLINE, "mb-2", className)}>
      {children}
    </h3>
  )
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
    <p className={cn(HINT, "py-12 text-center", className)}>{children}</p>
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
      {/* Wrapping, because three of these share a phone's width and a two-part
          figure like "2h 1m" would otherwise break across lines to make room for
          the delta. `whitespace-nowrap` keeps the value whole and sends the
          delta to the next line instead — it is the part that can move. */}
      <div className="flex flex-wrap items-baseline justify-center gap-x-1">
        <span className={cn("font-extrabold whitespace-nowrap tabular-nums", s.value)}>
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-semibold",
              // "Success" is the palette's green, not a colour picked here.
              deltaPositive ? TONE_TEXT.green : "text-muted-foreground",
            )}
          >
            {/* The arrow carries the direction as shape, not only as colour and
                a leading sign — the muted "down" tint is a weak signal, and the
                two greens are indistinguishable to some viewers. `aria-hidden`
                because the sign in the text already says it. */}
            {deltaPositive ? (
              <ArrowUp className="size-3 shrink-0" aria-hidden />
            ) : (
              <ArrowDown className="size-3 shrink-0" aria-hidden />
            )}
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
        <div className={cn(ITEM_TITLE, "truncate")}>{name}</div>
        <div className={cn(HINT, "truncate")}>{description}</div>
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
      <p className={cn(HINT, "mb-3 leading-relaxed")}>{description}</p>
      <ProgressMeter value={progress} tone={tone} label={name} />
      <div className="text-muted-foreground mt-1.5 mb-3 text-xs tabular-nums">{progressLabel}</div>
      <div className="mt-auto">
        {completed ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold",
              TONE_TEXT.green,
            )}
          >
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
