// Client for the backend `/words/related` endpoint.
//
// Given user-supplied "category" seed words (e.g. "kitchen, food, restaurants")
// and the active locale, calls the backend to expand them into a pool of
// related words via WordNet hyponyms. Returns the parsed list, or null on any
// error so callers can fall back to the hardcoded pool.

import { authApiUrl } from "@/lib/auth/client"
import type { Locale } from "@/lib/i18n/config"

/** Default cap on the size of the returned pool. The backend allows up to
 *  500 — 100 keeps payloads small while comfortably covering a long session. */
export const DEFAULT_RELATED_LIMIT = 100

/** Backend caps `words` array length at 50. */
const MAX_INPUT_WORDS = 50

/**
 * Normalize the raw textarea/input value into an array of category seed words.
 * - Splits on commas
 * - Trims whitespace
 * - Drops empty entries
 * - Lowercases (WordNet lookup is case-insensitive — frees the user from caring)
 * - De-duplicates while preserving first occurrence
 * - Caps to the backend's max length
 */
export function parseCategoriesInput(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const piece of raw.split(",")) {
    const cleaned = piece.trim().toLowerCase()
    if (!cleaned) continue
    if (seen.has(cleaned)) continue
    seen.add(cleaned)
    out.push(cleaned)
    if (out.length >= MAX_INPUT_WORDS) break
  }
  return out
}

type RelatedWordsResponse = {
  language: string
  words: string[]
}

/**
 * Fetch the related-words pool for the given seed words and locale.
 *
 * Returns the (possibly empty) word list, or null on any failure. Failures
 * are silent (a single console.log line) — by design, since the project is
 * deployed as a pure static frontend and the backend may simply not be
 * reachable. Callers must fall back to the hardcoded pool in that case.
 */
export async function fetchRelatedWords(
  words: string[],
  locale: Locale,
  limit: number = DEFAULT_RELATED_LIMIT,
): Promise<string[] | null> {
  if (words.length === 0) return null
  try {
    const res = await fetch(authApiUrl("/words/related"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words, language: locale, limit }),
    })
    if (!res.ok) {
      console.log(
        `[words-api] backend returned ${res.status}; falling back to hardcoded pool`,
      )
      return null
    }
    const data = (await res.json()) as RelatedWordsResponse
    return Array.isArray(data.words) ? data.words : null
  } catch (err) {
    console.log(
      "[words-api] backend unreachable; falling back to hardcoded pool",
      err,
    )
    return null
  }
}
