"use client"

import { useEffect } from "react"
import { ChartLine, NotebookPen, Wand2, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { useInspiration } from "@/lib/flowfic/inspiration"
import { type Story } from "@/lib/flowfic/stories-api"

import { type Section } from "./dashboard-nav"
import { InspirationDisplay } from "./inspiration-panel"
import { ProgressSection } from "./progress-section"
import { StoriesSection } from "./stories-section"
import { panelVariants } from "./dashboard-widgets"

/** Which face the pane below the selectors is showing. */
export type ShowcaseFace = "progress" | "inspiration" | "stories"

export const SHOWCASE_FACES: readonly ShowcaseFace[] = ["progress", "inspiration", "stories"]

// The strip mirrors the launcher's own grid — three equal columns, same gutter —
// so each circle is centred on the column its counterpart above occupies. That
// is what lines the left circle up with the session dial rather than shoving it
// against the container edge, and it holds at any width, since the columns are
// derived rather than a hardcoded inset.
const STRIP_GRID = "grid grid-cols-3 gap-3 md:gap-5"

// The circle: 90% of the session dial's diameter. The dial's size comes from the
// launcher's fixed height, so it is a constant per breakpoint — `w-44` (176px)
// while the pieces are stacked, and 229px once the `md` canvas takes over. On a
// phone the column is narrower than either cap, so `w-full` wins and the three
// circles fill the width, which is what we want there.
const CIRCLE_SIZE = "w-full sm:max-w-[9.9rem] md:max-w-[12.875rem]"

// Room around the strip, so the three circles read as their own band rather
// than as an appendix to the launcher. The reference is the circle's own inset
// from the container edge — the gap its column leaves beside it — mirrored
// above. That inset is `(column − circle) / 2`, i.e.
// `(((100% − 2×gap) / 3) − 12.875rem) / 2`, and the landing column already
// contributes its own `gap-6` (1.5rem), so the padding here makes up the
// difference: 3.8125rem − 1.5rem = 2.3125rem at the full 64rem measure, for
// 61px in total. Spelled out rather than interpolated from the constants
// above, because Tailwind only generates classes it can read literally in the
// source. The gap *under* the strip is deliberately smaller — the pane belongs
// to the circles, the launcher above does not.
const SHOWCASE_SPACING =
  "flex flex-col gap-5 pt-6 md:gap-8 md:pt-[calc(((100%_-_2.5rem)/3_-_12.875rem)/2_-_1.5rem)]"

// The pane. 3:2 on desktop — 683px at the shared measure, where 4:3 gave 768px
// and left visible slack inside every face. A phone swaps the ratio for a fixed
// height, because 3:2 at 375px wide is 229px, far too short for a list or for
// the progress face's four stacked boxes. 45rem is what that face needs there:
// its two rows split the pane evenly, so each box gets a quarter of it, and at
// anything less the level pair outgrows its share.
const PANE_SHAPE = "h-[45rem] sm:aspect-[3/2] sm:h-auto"

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

  // Selecting the face IS asking for an inspiration, so an empty store fills
  // itself rather than showing an invitation to click again. `unavailable` is
  // terminal (both pools failed to load), so this cannot loop.
  useEffect(() => {
    if (inspirationSelected && state.status === "unset") pick()
    // `pick` is a fresh closure each render; the status is what gates the call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspirationSelected, state.status])

  // Clicking the selected circle re-rolls. Coming back to it from another face
  // just shows what is already there — switching faces must not silently throw
  // the player's inspiration away.
  function selectInspiration() {
    onChangeFace("inspiration")
    if (inspirationSelected) pick()
  }

  const inspirationLabel =
    inspirationSelected && hasPick
      ? t.dashboard.inspirationTabAnother
      : t.dashboard.inspirationTabCurrent
  // The legend is trimmed to fit inside the circle; the accessible name spells
  // out what the click actually does.
  const inspirationAction =
    inspirationSelected && hasPick
      ? t.dashboard.inspirationAnother
      : t.dashboard.inspirationPrompt

  const faceName =
    face === "progress"
      ? t.nav.progress
      : face === "stories"
        ? t.dashboard.recentStories
        : t.dashboard.inspirationTabCurrent

  return (
    <section className={SHOWCASE_SPACING} aria-label={t.dashboard.showcaseLabel}>
      <div role="group" aria-label={t.dashboard.showcaseLabel} className={STRIP_GRID}>
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

      {/* `role="group"` because ARIA forbids naming a role-less element: as a
          bare div this was `role="generic"`, and the localized "Showing: …"
          label was dropped on the floor by every screen reader. */}
      <div
        role="group"
        aria-label={t.dashboard.showcasePaneLabel.replace("{name}", faceName)}
        className={cn(
          panelVariants({ padding: "none" }),
          "w-full overflow-hidden",
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
 * One circular selector: the button IS the circle, holding its icon with the
 * legend under it. Wears the mode cards' hover/selected treatment, since it is
 * the same kind of choice — only round.
 *
 * The inner padding is a percentage rather than a fixed inset, so the text keeps
 * clear of the curve at every size: a circle's usable width shrinks fast as the
 * circle does, and a fixed `p-4` that looks right at 206px pushes the legend
 * into the edge at 106px.
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
      className={cn(
        CIRCLE_SIZE,
        "mx-auto flex aspect-square flex-col items-center justify-center gap-1 rounded-full border p-[14%] text-center transition-colors",
        "hover:bg-accent/20 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-highlight bg-highlight/20 ring-highlight/30 ring-1"
          : "border-border bg-card",
      )}
    >
      <Icon
        className={cn(
          "size-6 shrink-0 transition-colors sm:size-8 md:size-10",
          active ? "text-highlight" : "text-muted-foreground",
        )}
        aria-hidden
      />
      {/* Clamped rather than truncated: the inspiration legend is a short
          phrase and must stay readable across both languages. */}
      <span
        className={cn(
          "line-clamp-2 text-[0.65rem] leading-tight font-semibold transition-colors sm:text-xs md:text-sm",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {legend}
      </span>
    </button>
  )
}
