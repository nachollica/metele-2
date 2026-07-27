// Client-side filtering, fuzzy search, and sorting for the My Stories list.
//
// The backend has no story-search endpoint, so this runs over the loaded page
// (see PAGE_SIZE in use-stories). Kept as a pure function so the relevance /
// date-range / sort behavior is unit-tested independently of the UI.

import Fuse from "fuse.js"

import type { Story } from "@/lib/flowfic/stories-api"

export type SortOrder = "newest" | "oldest"

export type StoryFilter = {
  /** Free-text fuzzy query over title + text. Empty = no search. */
  query: string
  /** Inclusive start of the created-at range (matched by local day), or null. */
  from: Date | null
  /** Inclusive end of the created-at range (matched by local day), or null. */
  to: Date | null
  /** Date order applied when there is no active query. */
  sort: SortOrder
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime()
}

function endOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
}

function withinRange(iso: string, from: Date | null, to: Date | null): boolean {
  if (!from && !to) return true
  const t = new Date(iso).getTime()
  if (from && t < startOfDay(from)) return false
  if (to && t > endOfDay(to)) return false
  return true
}

/**
 * Filter by the date range, then either fuzzy-search by relevance (when a query
 * is present) or order by created-at (newest/oldest). Title and text are both
 * searched; a null title is treated as an empty string.
 */
export function filterAndSortStories(stories: Story[], filter: StoryFilter): Story[] {
  const inRange = stories.filter((s) => withinRange(s.createdAt, filter.from, filter.to))

  const query = filter.query.trim()
  if (query.length > 0) {
    // Search over a normalized shape so a null title never trips Fuse.
    const docs = inRange.map((s) => ({ story: s, title: s.title ?? "", text: s.text }))
    const fuse = new Fuse(docs, {
      keys: ["title", "text"],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })
    return fuse.search(query).map((r) => r.item.story)
  }

  const byNewest = [...inRange].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  return filter.sort === "oldest" ? byNewest.reverse() : byNewest
}
