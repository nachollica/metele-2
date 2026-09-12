// The app's text scale, in one place.
//
// Five levels of structural text plus two muted supporting ones. Each is a
// Tailwind class string rather than a component, because the same level lands on
// wildly different tags — an `h2`, a Radix dialog title, a `<span>` naming a
// slider — and only the *look* is shared. Wherever a level also has a stable
// wrapper (a card's title row, say), that wrapper applies the token so callers
// never spell it themselves.
//
// Two rules keep this honest:
//
//   1. Heading TAG and text SIZE are independent. `h1`..`h4` describe document
//      structure for assistive tech; these tokens describe weight on screen. The
//      app's one `h1` lives in a cramped top bar and is deliberately not the
//      largest thing on any screen — which is exactly the inversion that made
//      this file necessary, so do not "fix" it by coupling the two again.
//   2. Anything genuinely display-sized — the session dial's readout, a stat
//      tile's figure, the editor, the required word — sits OUTSIDE this scale.
//      Those are numbers and prose meant to be looked at, not headings, and
//      folding them in here would drag the whole scale up to meet them.

/** The screen title in the top bar. The app's only `h1`. */
export const SCREEN_TITLE = "text-lg font-bold sm:text-xl"

/** A card or section title, and every dialog title. */
export const SECTION_TITLE = "text-lg font-semibold"

/** One row or card inside a list of them. */
export const ITEM_TITLE = "text-base font-semibold"

/** Names an interactive control or an account identity: setting names, form
 *  labels, mode cards. Never prose. */
export const FIELD_LABEL = "text-sm font-semibold"

/** Small-caps label above a block nested inside a larger card. */
export const OVERLINE = "text-muted-foreground text-xs font-semibold uppercase tracking-wide"

/** Supporting prose: descriptions, empty states, dialog descriptions. */
export const HINT = "text-muted-foreground text-sm"

/** Counters and meta lines — the smallest text that still has to be read. */
export const MICRO = "text-muted-foreground text-xs"
