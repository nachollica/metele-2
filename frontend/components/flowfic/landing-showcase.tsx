"use client"

import { ChartLine, NotebookPen, Wand2, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { useInspiration } from "@/lib/flowfic/inspiration"
import { type Story } from "@/lib/flowfic/stories-api"

import { type Section } from "./dashboard-nav"
import { InspirationDisplay } from "./inspiration-panel"
import { ProgressSection } from "./progress-section"
import { StoriesSection } from "./stories-section"

/** Which face the pane below the selectors is showing. */
export type ShowcaseFace = "progress" | "inspiration" | "stories"

export const SHOWCASE_FACES: readonly ShowcaseFace[] = ["progress", "inspiration", "stories"]

// The circle, ~70% of the session dial's diameter at every breakpoint. Three of
// the smallest still clear a 375px viewport with their gaps, which is why they
// never wrap — the strip reads the same on a phone, just tighter.
const CIRCLE_SIZE = "size-24 sm:size-32 md:size-40"

// The pane. Desktop takes the 4:3 the inspiration card always had; a phone
// swaps it for a fixed height, because 4:3 at 375px wide is 281px — too short
// for five story rows, and it would squash the progress face flat. 34rem is
// what the progress face needs at that width once its halves stack: less, and
// the weekly tiles outgrow their box and ride up over its heading.
const PANE_SHAPE = "h-[34rem] sm:aspect-[4/3] sm:h-auto"

type Props = {
  face: ShowcaseFace
  onChangeFace: (face: ShowcaseFace) => void
  /** Open an expanded subsection (from a face's "Show all"). */
  onShowSection: (section: Section) => void
  stories: Story[] | null
  storiesError: boolean
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateStoryTitle: (id: number, title: string | null) => Promise<boolean>
}

/**
 * The landing below the launcher: three circular selectors over one pane that
 * shows whichever they pick.
 *
 * The pane is a fixed shape and **never scrolls** — a short `overflow-y-auto`
 * box inside the scrolling landing swallows the wheel and freezes the page
 * under the pointer (see the `overscroll-behavior` note in CLAUDE.md). Each
 * face is therefore sized to fit the box exactly, the same discipline the
 * fixed-height stories panel always followed.
 *
 * The inspiration selector is the odd one out: it both selects and re-rolls, so
 * it carries three legends and the pane it fills is inert.
 */
export function LandingShowcase({
  face,
  onChangeFace,
  onShowSection,
  stories,
  storiesError,
  onViewStory,
  onDeleteStory,
  onUpdateStoryTitle,
}: Props) {
  const t = useTranslations()
  const { state, pick } = useInspiration()

  const hasPick = state.status === "image" || state.status === "quote"
  const inspirationSelected = face === "inspiration"

  // Selecting inspiration picks one when there is nothing to show; clicking it
  // again re-rolls. Coming back to a pick that is already made just shows it —
  // switching faces must not silently throw the player's inspiration away.
  function selectInspiration() {
    onChangeFace("inspiration")
    if (!inspirationSelected && hasPick) return
    pick()
  }

  const inspirationLabel = hasPick
    ? inspirationSelected
      ? t.dashboard.inspirationTabAnother
      : t.dashboard.inspirationTabCurrent
    : t.dashboard.inspirationTab
  // The visible legend is short enough for a circle; the accessible name spells
  // out what the click does.
  const inspirationAction = hasPick
    ? t.dashboard.inspirationAnother
    : t.dashboard.inspirationPrompt

  const faceName =
    face === "progress"
      ? t.nav.progress
      : face === "stories"
        ? t.dashboard.recentStories
        : t.dashboard.inspirationTabCurrent

  return (
    <section className="flex flex-col gap-5" aria-label={t.dashboard.showcaseLabel}>
      <div
        role="group"
        aria-label={t.dashboard.showcaseLabel}
        className="flex items-start justify-center gap-3 sm:gap-8"
      >
        <ShowcaseSelector
          icon={ChartLine}
          legend={t.nav.progress}
          active={face === "progress"}
          onClick={() => onChangeFace("progress")}
        />
        <ShowcaseSelector
          icon={Wand2}
          legend={inspirationLabel}
          label={inspirationAction}
          active={inspirationSelected}
          onClick={selectInspiration}
        />
        <ShowcaseSelector
          icon={NotebookPen}
          legend={t.dashboard.recentStories}
          active={face === "stories"}
          onClick={() => onChangeFace("stories")}
        />
      </div>

      <div
        aria-label={t.dashboard.showcasePaneLabel.replace("{name}", faceName)}
        className={cn(
          "bg-card text-card-foreground w-full overflow-hidden rounded-2xl border shadow-sm",
          PANE_SHAPE,
        )}
      >
        {face === "inspiration" ? (
          // Full-bleed: an image fills the frame edge to edge, and the quote
          // brings its own padding.
          <InspirationDisplay />
        ) : (
          <div className="flex size-full flex-col p-5">
            {face === "progress" ? (
              <ProgressSection preview flush onShowAll={() => onShowSection("progress")} />
            ) : (
              <StoriesSection
                preview
                flush
                stories={stories}
                error={storiesError}
                onShowAll={() => onShowSection("stories")}
                onViewStory={onViewStory}
                onDeleteStory={onDeleteStory}
                onUpdateTitle={onUpdateStoryTitle}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * One circular selector: an icon in the circle with its legend underneath, both
 * inside the button so the caption is part of the hit area and the accessible
 * name. Wears the mode cards' hover/selected treatment, since it is the same
 * kind of choice — only round.
 */
function ShowcaseSelector({
  icon: Icon,
  legend,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon
  legend: string
  /** Accessible name, when the visible legend is too terse to stand alone. */
  label?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className="group focus-visible:ring-ring flex w-24 flex-col items-center gap-2 rounded-2xl focus-visible:ring-2 focus-visible:outline-none sm:w-32 md:w-40"
    >
      <span
        className={cn(
          CIRCLE_SIZE,
          "flex items-center justify-center rounded-full border transition-colors",
          "group-hover:bg-accent/20",
          active
            ? "border-highlight bg-highlight/20 ring-highlight/30 ring-1"
            : "border-border bg-card",
        )}
      >
        <Icon
          className={cn(
            "size-8 transition-colors sm:size-10 md:size-12",
            active ? "text-highlight" : "text-muted-foreground",
          )}
          aria-hidden
        />
      </span>
      {/* Clamped rather than truncated: the inspiration legend is a short
          sentence and must stay readable across both languages. */}
      <span
        className={cn(
          "line-clamp-2 text-center text-xs font-semibold transition-colors sm:text-sm",
          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {legend}
      </span>
    </button>
  )
}
