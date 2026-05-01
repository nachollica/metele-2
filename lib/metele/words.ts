// Pool of "required words" the game can throw at the player.
// Mix of evocative nouns, verbs and adjectives to spark stories.
// Keep entries lowercase — matching is case-insensitive but normalized to lowercase.

export const REQUIRED_WORD_POOL: readonly string[] = [
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
  "compass",
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

/**
 * Pick a random word from the pool, avoiding any words in `exclude`.
 * Falls back to picking from the full pool if `exclude` covers everything.
 */
export function pickRequiredWord(exclude: ReadonlySet<string> = new Set()): string {
  const available = REQUIRED_WORD_POOL.filter((w) => !exclude.has(w))
  const source = available.length > 0 ? available : REQUIRED_WORD_POOL
  return source[Math.floor(Math.random() * source.length)]
}
