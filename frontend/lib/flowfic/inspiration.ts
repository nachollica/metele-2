// Client-side loader + shared "current pick" store for the inspiration image.
//
// The catalog (public/inspiration/images.vN.jsonl) is parsed from film-grab's
// image sitemaps by the word-assets tool (`just inspiration`). Each line is one
// film: `loc` (the film-grab page path we credit/link to) and `img` (the image
// path we render), both with the common `https://film-grab.com/` host stripped
// on disk (~4000 lines would otherwise repeat it) and reconstructed into full
// URLs by `parseInspirationJsonl` below — see `FILM_GRAB_PREFIX`. The display
// title is not stored either — it is derived from the (reconstructed) `loc`
// slug here (see `deriveTitle`), since the card renders it upper-cased. It is a
// generated, gitignored, optional artifact — if it is missing the loader
// resolves to null and the card simply shows its reserved placeholder.
//
// The "current inspiration" is a single shared pick — either a film still or a
// quote — held in a tiny external store so the home card and the in-game pane
// always agree. It starts UNSET: the home card renders an invitation, and one
// click picks (50/50 image vs quote, then a random item from that pool).
// Clicking again re-rolls. The pick is persisted in sessionStorage so a reload
// keeps it, and is cleared when a story is finalized. Only the chosen image is
// ever fetched cross-origin, by a plain <img>; film-grab serves the images with
// `access-control-allow-origin: *` and a one-year cache.

import { useSyncExternalStore } from "react"

import { loadQuotes, type Quote } from "@/lib/flowfic/quotes"

/** Bump alongside INSPIRATION_VERSION in word-assets/src/contract.py. */
export const INSPIRATION_VERSION = 1

/**
 * Host every `loc`/`img` in the JSONL is stripped of on disk; prepended back by
 * `parseInspirationJsonl`. Mirror of `_PREFIX` in
 * word-assets/src/build_inspiration.py.
 */
export const FILM_GRAB_PREFIX = "https://film-grab.com/"

export type InspirationImageData = {
  /**
   * Display title derived from the `loc` slug, e.g. "and the ship sails on".
   * The card upper-cases it in CSS, which also renders numerals/roman-numeral
   * acronyms correctly ("VII"), so no per-word capitalization is applied.
   */
  title: string
  /** film-grab page URL (the credit link target). */
  loc: string
  /** Direct image URL to render. */
  img: string
}

/**
 * Film title from a film-grab page URL's last path segment: hyphens to spaces.
 * `.../2014/12/12/and-the-ship-sails-on/` -> `and the ship sails on`. Left
 * lower-case on purpose — the card styles the title `uppercase`, so this stays a
 * plain slug decode (see `InspirationImageData.title`).
 */
export function deriveTitle(loc: string): string {
  const slug = loc.replace(/\/+$/, "").split("/").pop() ?? ""
  return slug.split("-").filter(Boolean).join(" ")
}

// undefined = not yet attempted; null = attempted and unavailable.
let cache: readonly InspirationImageData[] | null | undefined
let inflight: Promise<readonly InspirationImageData[] | null> | undefined

/**
 * Load (and memoize) the inspiration catalog.
 *
 * Resolves to null on any failure (including a missing file — the artifact is
 * optional), so callers degrade gracefully rather than throwing. The file is
 * fetched at most once per page load.
 */
export async function loadInspiration(): Promise<readonly InspirationImageData[] | null> {
  if (cache !== undefined) return cache
  if (inflight) return inflight

  inflight = (async (): Promise<readonly InspirationImageData[] | null> => {
    try {
      const res = await fetch(`/inspiration/images.v${INSPIRATION_VERSION}.jsonl`)
      if (!res.ok) {
        cache = null
        return null
      }
      const images = parseInspirationJsonl(await res.text())
      cache = images
      return images
    } catch {
      cache = null
      return null
    } finally {
      inflight = undefined
    }
  })()
  return inflight
}

/**
 * Parse the JSONL body into records, skipping blank lines. Each line is a
 * `{loc, img}` object with the `FILM_GRAB_PREFIX` host stripped; this
 * reconstructs the full URLs and derives the display `title` from `loc`.
 * Exported for tests.
 */
export function parseInspirationJsonl(body: string): InspirationImageData[] {
  const images: InspirationImageData[] = []
  for (const line of body.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const { loc, img } = JSON.parse(trimmed) as { loc: string; img: string }
    const fullLoc = FILM_GRAB_PREFIX + loc
    const fullImg = FILM_GRAB_PREFIX + img
    images.push({ title: deriveTitle(fullLoc), loc: fullLoc, img: fullImg })
  }
  return images
}

// ---- Shared "current pick" store ------------------------------------------

/**
 * The current inspiration.
 *
 * `unset` is the resting state: nothing has been picked (or a finished story
 * just cleared it), and the home card shows its invitation. `picking` covers
 * the moment between the click and the pools resolving. `unavailable` means
 * both pools failed to load, so there is nothing to offer.
 */
export type InspirationState =
  | { status: "unset" }
  | { status: "picking" }
  | { status: "unavailable" }
  | { status: "image"; image: InspirationImageData }
  | { status: "quote"; quote: Quote }

const STORAGE_KEY = `flowfic:inspiration:v${INSPIRATION_VERSION}`

// Stable references: useSyncExternalStore requires getSnapshot to return the
// same value until something actually changes.
const UNSET: InspirationState = { status: "unset" }
const PICKING: InspirationState = { status: "picking" }
const UNAVAILABLE: InspirationState = { status: "unavailable" }

let state: InspirationState = UNSET
let restored = false
const listeners = new Set<() => void>()

function setState(next: InspirationState): void {
  state = next
  for (const notify of listeners) notify()
}

/** What sessionStorage holds: enough to re-resolve the pick after a reload. */
type StoredPick = { kind: "image"; loc: string } | { kind: "quote"; id: string }

function readStored(): StoredPick | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredPick) : null
  } catch {
    return null
  }
}

function writeStored(pick: StoredPick | null): void {
  try {
    if (pick === null) window.sessionStorage.removeItem(STORAGE_KEY)
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pick))
  } catch {
    // Private mode / storage disabled: the pick just won't survive a reload.
  }
}

/** Pick a random member of a non-empty pool, avoiding `exclude` when possible. */
function sample<T>(pool: readonly T[], isCurrent: (item: T) => boolean): T {
  if (pool.length === 1) return pool[0]
  let next: T
  do {
    next = pool[Math.floor(Math.random() * pool.length)]
  } while (isCurrent(next))
  return next
}

/**
 * Pick a fresh inspiration: a coin flip between the film-still catalog and the
 * quote pool, then a random item from the chosen one. Falls back to the other
 * pool when the first is missing (both artifacts are optional), and reports
 * `unavailable` only when neither has anything.
 */
export async function pickInspiration(): Promise<void> {
  setState(PICKING)
  const [images, quotes] = await Promise.all([loadInspiration(), loadQuotes()])
  const hasImages = Boolean(images && images.length > 0)
  const hasQuotes = Boolean(quotes && quotes.length > 0)
  if (!hasImages && !hasQuotes) {
    setState(UNAVAILABLE)
    return
  }

  // 50/50 when both pools are available; otherwise whichever one there is.
  const wantImage = hasImages && (!hasQuotes || Math.random() < 0.5)
  if (wantImage) {
    const currentLoc = state.status === "image" ? state.image.loc : undefined
    const image = sample(images!, (i) => i.loc === currentLoc)
    writeStored({ kind: "image", loc: image.loc })
    setState({ status: "image", image })
    return
  }
  const currentId = state.status === "quote" ? state.quote.id : undefined
  const quote = sample(quotes!, (q) => q.id === currentId)
  writeStored({ kind: "quote", id: quote.id })
  setState({ status: "quote", quote })
}

/** Drop the current inspiration (called when a story is finalized). */
export function clearInspiration(): void {
  writeStored(null)
  setState(UNSET)
}

// Re-resolve the session's stored pick, once, on the first subscribe. Nothing
// is picked here — an absent/stale entry simply leaves the store unset.
function restore(): void {
  if (restored) return
  restored = true
  const stored = readStored()
  if (stored === null) return
  setState(PICKING)
  if (stored.kind === "image") {
    void loadInspiration().then((images) => {
      const image = images?.find((i) => i.loc === stored.loc)
      setState(image ? { status: "image", image } : UNSET)
    })
    return
  }
  void loadQuotes().then((quotes) => {
    const quote = quotes?.find((q) => q.id === stored.id)
    setState(quote ? { status: "quote", quote } : UNSET)
  })
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  restore()
  return () => {
    listeners.delete(onChange)
  }
}

function getSnapshot(): InspirationState {
  return state
}

function getServerSnapshot(): InspirationState {
  return UNSET
}

/**
 * Subscribe to the shared inspiration pick. The home card and the in-game pane
 * both use this, so they always show the same thing; `pick` re-rolls it for all
 * and `clear` resets to the unset state.
 */
export function useInspiration(): {
  state: InspirationState
  pick: () => void
  clear: () => void
} {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return {
    state: current,
    pick: () => void pickInspiration(),
    clear: clearInspiration,
  }
}

/** Test seam: wipe the module-level store AND the catalog cache between tests. */
export function resetInspirationStoreForTests(): void {
  state = UNSET
  restored = false
  listeners.clear()
  cache = undefined
  inflight = undefined
}
