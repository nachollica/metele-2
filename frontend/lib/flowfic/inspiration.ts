// Client-side loader + shared "current pick" store for the inspiration image.
//
// The catalog (public/inspiration/images.vN.jsonl) is parsed from film-grab's
// image sitemaps by the word-assets tool (`just inspiration`). Each line is one
// film: a display title (derived from the film-grab page slug), the page URL we
// credit/link to, and the direct image URL we render. It is a generated,
// gitignored, optional artifact — if it is missing the loader resolves to null
// and the card simply shows its reserved placeholder.
//
// One image is chosen per browsing session and shared by both consumers (the
// landing card and the game/setup pane) through a tiny external store, so they
// always agree. The choice is persisted in sessionStorage and only changes when
// the user clicks the card's refresh control (not on reload). Only the chosen
// image is ever fetched cross-origin, by a plain <img>; film-grab serves the
// images with `access-control-allow-origin: *` and a one-year cache.

import { useSyncExternalStore } from "react"

/** Bump alongside INSPIRATION_VERSION in word-assets/src/contract.py. */
export const INSPIRATION_VERSION = 1

export type InspirationImageData = {
  /** Display title, e.g. "And The Ship Sails On". */
  title: string
  /** film-grab page URL (the credit link target). */
  page: string
  /** Direct image URL to render. */
  image: string
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

/** Parse the JSONL body into records, skipping blank lines. Exported for tests. */
export function parseInspirationJsonl(body: string): InspirationImageData[] {
  const images: InspirationImageData[] = []
  for (const line of body.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    images.push(JSON.parse(trimmed) as InspirationImageData)
  }
  return images
}

/**
 * Pick a random film, avoiding `currentPage` when the pool has alternatives so a
 * refresh visibly changes the image. Assumes a non-empty pool (callers guard).
 * Pages are unique in the catalog, so the loop terminates promptly.
 */
export function chooseNext(
  pool: readonly InspirationImageData[],
  currentPage?: string,
): InspirationImageData {
  if (pool.length === 1) return pool[0]
  let next: InspirationImageData
  do {
    next = pool[Math.floor(Math.random() * pool.length)]
  } while (next.page === currentPage)
  return next
}

// ---- Shared "current pick" store ------------------------------------------

export type InspirationState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; image: InspirationImageData }

const STORAGE_KEY = `flowfic:inspiration:v${INSPIRATION_VERSION}`

// Stable references: useSyncExternalStore requires getSnapshot to return the
// same value until something actually changes.
const LOADING: InspirationState = { status: "loading" }
const EMPTY: InspirationState = { status: "empty" }

let state: InspirationState = LOADING
let pool: readonly InspirationImageData[] | null = null
let started = false
const listeners = new Set<() => void>()

function setState(next: InspirationState): void {
  state = next
  for (const notify of listeners) notify()
}

function readStoredPage(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredPage(page: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, page)
  } catch {
    // Private mode / storage disabled: the pick just won't survive a reload.
  }
}

// Load the pool once, then resolve the initial pick: the session's stored film
// if it is still present, otherwise a fresh random one.
function start(): void {
  if (started) return
  started = true
  void loadInspiration().then((loaded) => {
    if (!loaded || loaded.length === 0) {
      setState(EMPTY)
      return
    }
    pool = loaded
    const storedPage = readStoredPage()
    const stored = storedPage ? loaded.find((p) => p.page === storedPage) : undefined
    const image = stored ?? chooseNext(loaded)
    writeStoredPage(image.page)
    setState({ status: "ready", image })
  })
}

/** Re-roll to a different film on demand (the card's refresh control). */
export function refreshInspiration(): void {
  if (!pool || pool.length === 0) return
  const current = state.status === "ready" ? state.image.page : undefined
  const image = chooseNext(pool, current)
  writeStoredPage(image.page)
  setState({ status: "ready", image })
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  start()
  return () => {
    listeners.delete(onChange)
  }
}

function getSnapshot(): InspirationState {
  return state
}

function getServerSnapshot(): InspirationState {
  return LOADING
}

/**
 * Subscribe to the shared inspiration pick. Both the landing card and the game
 * pane use this, so they render the same image; `refresh` re-rolls it for all.
 */
export function useInspiration(): { state: InspirationState; refresh: () => void } {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { state: current, refresh: refreshInspiration }
}
