// Pool of "required words" the game can throw at the player.
// Organized by locale so each language gets its own evocative words.
// Keep entries lowercase — matching is case-insensitive but normalized to lowercase.

import type { Locale } from "@/lib/i18n/config"

// ---- English pool --------------------------------------------------------

const ENGLISH_WORDS: readonly string[] = [
  "lighthouse",
  "whisper",
  "rust",
  "midnight",
  "feather",
  "kingdom",
  "broken",
  "harvest",
  "echo",
  "lantern",
  "stranger",
  "compass",
  "thunder",
  "velvet",
  "marble",
  "ember",
  "labyrinth",
  "promise",
  "violet",
  "shadow",
  "silver",
  "garden",
  "porcelain",
  "horizon",
  "ritual",
  "freight",
  "saffron",
  "mirror",
  "anchor",
  "splinter",
  "courage",
  "wolf",
  "letter",
  "harbor",
  "gravity",
  "whistle",
  "saltwater",
  "carnival",
  "machine",
  "dust",
  "verge",
  "ribbon",
  "trespass",
  "marigold",
  "asylum",
  "fugitive",
  "honey",
  "monsoon",
  "exile",
] as const

// ---- Spanish pool --------------------------------------------------------
// Mix of evocative nouns, verbs and adjectives to spark stories in Spanish.
// Entries are *without* diacritics intentionally — the matching engine
// normalizes both the pool word and the player's text before comparing.

const SPANISH_WORDS: readonly string[] = [
  "laberinto",
  "susurro",
  "ceniza",
  "medianoche",
  "pluma",
  "reino",
  "roto",
  "cosecha",
  "eco",
  "farol",
  "extraño",
  "brújula",
  "trueno",
  "terciopelo",
  "mármol",
  "brasa",
  "promesa",
  "violeta",
  "sombra",
  "plata",
  "jardín",
  "porcelana",
  "horizonte",
  "ritual",
  "azafrán",
  "espejo",
  "ancla",
  "astilla",
  "coraje",
  "lobo",
  "carta",
  "puerto",
  "gravedad",
  "silbido",
  "carnaval",
  "máquina",
  "polvo",
  "cinta",
  "exilio",
  "miel",
  "monzón",
  "tormenta",
  "destello",
  "naufragio",
  "vértigo",
  "campana",
  "umbral",
  "fugitivo",
  "relámpago",
  "oleaje",
] as const

// ---- Locale → pool map ---------------------------------------------------

const WORD_POOLS: Record<string, readonly string[]> = {
  en: ENGLISH_WORDS,
  es: SPANISH_WORDS,
}

/**
 * Get the word pool for a given locale.
 * Falls back to English (and logs a warning) if the locale is unknown.
 */
export function getWordPool(locale: Locale): readonly string[] {
  const pool = WORD_POOLS[locale]
  if (pool) return pool
  console.warn(
    `[words] No word pool for locale "${locale}". Falling back to English.`,
  )
  return ENGLISH_WORDS
}

/**
 * Pick a random word from the pool for the given locale, avoiding any
 * words in `exclude`. Falls back to picking from the full pool if
 * `exclude` covers everything.
 */
export function pickRequiredWord(
  locale: Locale,
  exclude: ReadonlySet<string> = new Set(),
): string {
  const pool = getWordPool(locale)
  const available = pool.filter((w) => !exclude.has(normalizeForMatch(w)))
  const source = available.length > 0 ? available : pool
  return source[Math.floor(Math.random() * source.length)]
}

// ---- Diacritics-insensitive matching helpers ------------------------------

/**
 * Strip diacritics (accents) and convert to lowercase for comparison.
 * E.g. "brújula" → "brujula", "MÁRMOL" → "marmol"
 *
 * Uses Unicode NFD normalization to decompose accented characters into
 * base character + combining mark, then strips the combining marks.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

/**
 * Check whether `candidate` matches `required` in a diacritics-insensitive,
 * case-insensitive manner, also ignoring surrounding punctuation.
 *
 * E.g. matchesWord("brújula", "brujula") → true
 *      matchesWord("¡Mármol!", "marmol") → true
 */
export function matchesWord(candidate: string, required: string): boolean {
  // Strip leading/trailing punctuation from candidate
  const stripped = candidate.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "")
  return normalizeForMatch(stripped) === normalizeForMatch(required)
}
