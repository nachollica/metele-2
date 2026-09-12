// Request bodies and identities the journeys need.

import { config } from './config.js'

// The dev backdoor's token is `<shared secret>:<username>` — it is not a JWT,
// and `dev_login` only looks the username up. So a virtual user can present a
// valid identity by constructing the string, with no login round-trip. That is
// deliberate: real players arrive with an Auth0 token already in hand, so
// hammering /auth/dev-login would be load that production never actually sees.
export function authHeader(username) {
  return { Authorization: `Bearer ${config.devToken}:${username}` }
}

// The synthetic users this run seeded, addressed by index. Journeys pick from
// the whole population so the story-scanning endpoints see the same mix of
// light and heavy accounts the seeding created.
export function pickUser() {
  const index = 1 + Math.floor(Math.random() * config.userCount)
  return `lt_${config.runId}_${index}`
}

const SEED_WORDS = [
  ['cocina', 'comida'],
  ['bosque', 'animal'],
  ['ciudad', 'noche'],
  ['mar', 'viaje'],
  ['kitchen', 'food'],
  ['forest', 'animal'],
  ['city', 'night'],
]

export function relatedWordsBody() {
  return JSON.stringify({
    words: SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)],
    language: config.lang,
    // Mirrors DEFAULT_RELATED_LIMIT in the frontend's words-api client.
    limit: 100,
  })
}

export function randomWordsBody() {
  return JSON.stringify({ language: config.lang, limit: 100 })
}

const TEXT_FRAGMENT =
  'the light fell across the table and nothing in the room moved for a while ' +
  'she wrote until the words stopped meaning anything and then kept going '

function storyText(words) {
  const pool = TEXT_FRAGMENT.split(' ')
  const out = []
  while (out.length < words) out.push(pool[out.length % pool.length])
  return out.join(' ')
}

// Matches StorySettingsStrict / StoryStatsStrict, which forbid unknown keys.
// Worth stating explicitly: the rows already in production carry the *older*
// shape (bellEnabled, categoryWordsInput), which still validates on read but
// would be rejected here — create-time is strict, read-time is lenient.
export function createStoryBody() {
  const words = 80 + Math.floor(Math.random() * 340)
  const durationSeconds = [300, 600, 900, 1500, 2700][Math.floor(Math.random() * 5)]
  return JSON.stringify({
    title: null,
    text: storyText(words),
    lang: config.lang,
    settings: {
      idleTimerEnabled: true,
      mainTimerSeconds: 8,
      globalTimerSeconds: durationSeconds,
      requiredWordIntervalEnabled: true,
      requiredWordIntervalSeconds: 30,
      requiredWordUseTimerEnabled: true,
      requiredWordUseTimerSeconds: 30,
      soundEnabled: true,
      soundMode: 'bell',
      wordSource: 'free',
      wordSourceSeeds: '',
    },
    stats: {
      reason: 'global-timeout',
      durationMs: durationSeconds * 1000,
      characters: words * 6,
      words: words,
      requiredWordsUsed: Math.floor(Math.random() * 25),
    },
  })
}

// The browser sends its IANA zone on every /stats call so day boundaries line
// up with the player's wall clock; omitting it would silently exercise the UTC
// fallback instead of the path real clients take.
export const TZ = 'America/Argentina/Buenos_Aires'
