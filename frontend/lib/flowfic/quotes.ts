// Client-side loader for the "quote of the day" pool.
//
// The pool (public/quotes/quotes.vN.jsonl) is hand-curated from public-domain
// literature by the word-assets tool (see word-assets/README.md → "Quote of the
// day"). Unlike the match map it is small, committed content, not a generated
// artifact. We load it once (cached, versioned/immutable) and pick today's quote
// locally; there is no backend call.
//
// Each line is one quote whose `text` maps a language to an array of paragraph
// blocks — one element per line/turn, so a multi-block dialogue renders across
// several paragraphs. The stored blocks are already normalized; the frontend
// renders them verbatim.

import type { Locale } from "@/lib/i18n/config"
import { dailyIndex } from "@/lib/flowfic/gamification"

/** Bump alongside QUOTES_VERSION in word-assets/src/contract.py. */
export const QUOTES_VERSION = 1

export type QuoteKind = "statement" | "prose" | "dialogue"

export type Quote = {
  id: string
  author: string
  /** Work the quote is taken from (e.g. book title). */
  source: string
  kind: QuoteKind
  /** Language the quote was taken from verbatim. */
  lang_source: string
  /**
   * Optional, sparse title translations: locale → translated `source` title,
   * for locales other than `lang_source` (whose title is `source` itself).
   * Present only for titles we have a confident translation of; a missing
   * locale falls back to `source` (see {@link quoteTitle}).
   */
  source_i18n?: Record<string, string>
  origin: {
    file: string
    md5: string
    char_start: number
    char_end: number
  }
  /** Language code → paragraph blocks. Always has `lang_source`. */
  text: Record<string, string[]>
}

// undefined = not yet attempted; null = attempted and unavailable.
let cache: readonly Quote[] | null | undefined
let inflight: Promise<readonly Quote[] | null> | undefined

/**
 * Load (and memoize) the quote pool.
 *
 * Resolves to null on any failure — the card then simply renders nothing rather
 * than throwing. The file is versioned and immutable, so the browser caches it
 * after the first load.
 */
export async function loadQuotes(): Promise<readonly Quote[] | null> {
  if (cache !== undefined) return cache
  if (inflight) return inflight

  inflight = (async (): Promise<readonly Quote[] | null> => {
    try {
      const res = await fetch(`/quotes/quotes.v${QUOTES_VERSION}.jsonl`)
      if (!res.ok) {
        cache = null
        return null
      }
      const text = await res.text()
      const quotes = parseQuotesJsonl(text)
      cache = quotes
      return quotes
    } catch {
      cache = null
      return null
    } finally {
      inflight = undefined
    }
  })()
  return inflight
}

/** Test seam: drop the memoized pool so a test can re-stub the fetch. */
export function resetQuotesCacheForTests(): void {
  cache = undefined
  inflight = undefined
}

/** Parse the JSONL body into quotes, skipping blank lines. Exported for tests. */
export function parseQuotesJsonl(body: string): Quote[] {
  const quotes: Quote[] = []
  for (const line of body.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    quotes.push(JSON.parse(trimmed) as Quote)
  }
  return quotes
}

/** Today's quote from a loaded pool (stable across a day), or null if empty. */
export function quoteOfTheDay(quotes: readonly Quote[], d: Date = new Date()): Quote | null {
  if (quotes.length === 0) return null
  return quotes[dailyIndex(quotes.length, d)]
}

/** Paragraph blocks for `quote` in `locale`, falling back to its source language. */
export function quoteBlocks(quote: Quote, locale: Locale): string[] {
  return quote.text[locale] ?? quote.text[quote.lang_source] ?? []
}

/** The work's title for `locale`, falling back to the original `source` title. */
export function quoteTitle(quote: Quote, locale: Locale): string {
  return quote.source_i18n?.[locale] ?? quote.source
}
