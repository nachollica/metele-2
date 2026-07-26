// Client-side required-word matching against the precomputed "match map".
//
// The map (public/match-map/{locale}.vN.json) is generated at backend build time
// by app/scripts/build_match_map.py, from the SAME word pool the backend samples
// required words from. It maps a normalized surface form to an integer group id;
// two words are the same word inflected iff they share a group id. We load it
// once (cached, versioned/immutable) and decide every match locally — no
// per-keystroke backend call.
//
// Two things are deliberately duplicated from the Python builder and MUST stay
// in sync (kept intentionally tiny):
//   1. normalizeForMatch (imported from ./words) — the map keys are normalized
//      with the exact same algorithm the builder uses.
//   2. isRegularPlural below — the plural backstop (e.g. leaf/leaves) the builder
//      leaves to runtime, mirroring the backend's former _is_regular_plural.

import type { Locale } from "@/lib/i18n/config"
import { normalizeForMatch } from "@/lib/flowfic/words"

/** Bump alongside MATCH_MAP_VERSION in app/scripts/build_match_map.py. */
export const MATCH_MAP_VERSION = 1

/** Normalized surface form → inflection-group id. */
export type MatchMap = ReadonlyMap<string, number>

// undefined = not yet attempted; null = attempted and unavailable.
const cache = new Map<Locale, MatchMap | null>()
const inflight = new Map<Locale, Promise<MatchMap | null>>()

/**
 * Load (and memoize) the match map for `locale`.
 *
 * Resolves to null on any failure — matching then degrades to exact + regular
 * plural rather than throwing. The file is versioned and immutable, so the
 * browser caches it after the first load; subsequent games start instantly.
 */
export async function loadMatchMap(locale: Locale): Promise<MatchMap | null> {
  const cached = cache.get(locale)
  if (cached !== undefined) return cached
  const pending = inflight.get(locale)
  if (pending) return pending

  const run = (async (): Promise<MatchMap | null> => {
    try {
      const res = await fetch(`/match-map/${locale}.v${MATCH_MAP_VERSION}.json`)
      if (!res.ok) {
        cache.set(locale, null)
        return null
      }
      const obj = (await res.json()) as Record<string, number>
      const map: MatchMap = new Map(Object.entries(obj))
      cache.set(locale, map)
      return map
    } catch {
      cache.set(locale, null)
      return null
    } finally {
      inflight.delete(locale)
    }
  })()
  inflight.set(locale, run)
  return run
}

/**
 * Regular-plural backstop for pairs the map leaves apart (e.g. leaf/leaves).
 * Mirrors the backend's former `_is_regular_plural`; operates on normalized
 * forms.
 */
export function isRegularPlural(a: string, b: string, locale: Locale): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (!short || short === long) return false
  if (long === short + "s" || long === short + "es") return true
  if (locale === "es") {
    // luz → luces, pez → peces
    return short.endsWith("z") && long === short.slice(0, -1) + "ces"
  }
  // English: baby → babies, leaf → leaves, knife → knives
  if (short.endsWith("y") && long === short.slice(0, -1) + "ies") return true
  if (short.endsWith("fe") && long === short.slice(0, -2) + "ves") return true
  return short.endsWith("f") && long === short.slice(0, -1) + "ves"
}

// Strip leading/trailing punctuation from the candidate (matches the old
// matchesWord contract — the required word never carries punctuation).
const EDGE_PUNCT = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu

/**
 * Whether `candidate` satisfies `required`: the same word after normalization,
 * the same inflection group in `map`, or a regular plural of it. With `map` null
 * (not yet loaded, or offline) it still handles exact + plural, so it is always
 * a safe superset of a plain normalized-equality check.
 */
export function isInflectionMatch(
  candidate: string,
  required: string,
  locale: Locale,
  map: MatchMap | null,
): boolean {
  const c = normalizeForMatch(candidate.replace(EDGE_PUNCT, ""))
  const r = normalizeForMatch(required)
  if (c === r) return true
  if (map) {
    const gc = map.get(c)
    const gr = map.get(r)
    if (gc !== undefined && gc === gr) return true
  }
  return isRegularPlural(c, r, locale)
}
