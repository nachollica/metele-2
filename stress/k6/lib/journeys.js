// The five journeys, traced from the frontend's actual call sites rather than
// from the route list — what a real visit triggers, in the order it triggers it.
//
// The shape that matters most: a sprint runs 5-45 minutes and makes *no*
// backend calls at all while it does. So the traffic is bursty at page load,
// spends one expensive call at sprint start, one small write at the end, and is
// otherwise silent. That is why the default mix is so read-heavy.

import http from 'k6/http'
import { check, sleep } from 'k6'

import { config } from './config.js'
import { authHeader, createStoryBody, pickUser, randomWordsBody, relatedWordsBody, TZ } from './payloads.js'

const BASE = config.baseUrl

// Discovered once in setup() rather than hardcoded: Next.js content-hashes every
// chunk name, so a redeploy changes all of them. Parsing index.html is both
// redeploy-proof and exactly what a browser does.
let assets = []

export function setAssets(list) {
  assets = list
}

export function discoverAssets() {
  const res = http.get(`${BASE}/`, { tags: { name: 'index.html' } })
  if (res.status !== 200) {
    throw new Error(`Could not load ${BASE}/ to discover assets (status ${res.status}).`)
  }
  const found = new Set()
  const pattern = /\/_next\/static\/(?:chunks|media)\/[A-Za-z0-9._~-]+\.(?:js|css|woff2)/g
  let match
  while ((match = pattern.exec(res.body)) !== null) found.add(match[0])
  return [...found]
}

function ok(res, name) {
  check(res, { [`${name} ok`]: (r) => r.status >= 200 && r.status < 400 })
  return res
}

// ---- Static page load --------------------------------------------------

// What every visit costs before any API call: the shell, its chunk graph, and
// the data assets. `batch` mirrors a browser fetching them concurrently over one
// connection rather than serialising them.
function loadShell() {
  ok(http.get(`${BASE}/`, { tags: { name: 'index.html' } }), 'index')

  if (assets.length > 0) {
    const requests = assets.map((path) => ['GET', `${BASE}${path}`, null, { tags: { name: 'chunk' } }])
    http.batch(requests)
  }

  // The match map is the single heaviest asset the app fetches — 2.9MB for es
  // against 800KB for en — and Caddy compresses it per request unless the CDN
  // absorbs it. Which locale a run uses therefore changes the static load a lot.
  ok(
    http.get(`${BASE}/match-map/${config.lang}.v1.json`, { tags: { name: 'match-map' } }),
    'match-map',
  )
  ok(
    http.get(`${BASE}/inspiration/images.v1.jsonl`, { tags: { name: 'inspiration' } }),
    'inspiration',
  )
  ok(http.get(`${BASE}/api/ping`, { tags: { name: 'ping' } }), 'ping')
}

// ---- Journeys ----------------------------------------------------------

/** An anonymous visitor: the static cost with no authenticated calls at all. */
export function anon() {
  loadShell()
  sleep(1 + Math.random() * 2)
}

/** A signed-in landing: the shell, then /auth/me and the three parallel stats calls. */
export function landing() {
  loadShell()

  const user = pickUser()
  const headers = authHeader(user)

  ok(http.get(`${BASE}/api/auth/me`, { headers, tags: { name: 'auth/me' } }), 'auth/me')

  // The gamification context fires these three together, and each one scans
  // every story the user owns — so a heavy account costs three full scans per
  // landing. This is the reason seeding depth matters.
  const responses = http.batch([
    ['GET', `${BASE}/api/stats/overview?tz=${TZ}`, null, { headers, tags: { name: 'stats/overview' } }],
    ['GET', `${BASE}/api/stats/achievements?tz=${TZ}`, null, { headers, tags: { name: 'stats/achievements' } }],
    ['GET', `${BASE}/api/stats/challenges?tz=${TZ}`, null, { headers, tags: { name: 'stats/challenges' } }],
  ])
  responses.forEach((res, i) => ok(res, `stats[${i}]`))

  sleep(2 + Math.random() * 3)
}

/**
 * Starting a sprint: the one CPU-expensive call in the app.
 *
 * Each seed runs a full (N x 300) matmul plus an argsort over the whole pool.
 * On a worker whose vectors have been paged out, the first such call also has
 * to fault ~150MB back in from swap before it can compute anything.
 */
export function sprint() {
  const headers = { ...authHeader(pickUser()), 'Content-Type': 'application/json' }
  // Most players give category seeds; the rest get an unseeded random pool.
  const seeded = Math.random() < 0.7
  const res = seeded
    ? http.post(`${BASE}/api/words/related`, relatedWordsBody(), {
        headers,
        tags: { name: 'words/related' },
      })
    : http.post(`${BASE}/api/words/random`, randomWordsBody(), {
        headers,
        tags: { name: 'words/random' },
      })
  ok(res, seeded ? 'words/related' : 'words/random')
  sleep(1)
}

/** Browsing the library: list, count, and one detail. */
export function stories() {
  const headers = authHeader(pickUser())

  const list = ok(
    http.get(`${BASE}/api/stories?limit=100&offset=0`, { headers, tags: { name: 'stories/list' } }),
    'stories/list',
  )
  ok(http.get(`${BASE}/api/stories/count`, { headers, tags: { name: 'stories/count' } }), 'stories/count')

  // Open one of the returned stories, the way a reader would. Skipped for an
  // account with none, rather than fabricating an id that would 404 and count
  // against the error budget for a reason unrelated to the server's health.
  try {
    const items = list.json('items')
    if (Array.isArray(items) && items.length > 0) {
      const pick = items[Math.floor(Math.random() * items.length)]
      ok(
        http.get(`${BASE}/api/stories/${pick.id}`, { headers, tags: { name: 'stories/detail' } }),
        'stories/detail',
      )
    }
  } catch (err) {
    // A body that will not parse is already counted as a failed check above.
  }

  sleep(2 + Math.random() * 4)
}

/**
 * Finishing a sprint: the write, then the gamification refresh it triggers.
 *
 * The rarest journey by a wide margin — minutes of writing sit between a start
 * and its save — which is why the default mix weights it lowest.
 */
export function finish() {
  const user = pickUser()
  const headers = { ...authHeader(user), 'Content-Type': 'application/json' }

  const created = http.post(`${BASE}/api/stories`, createStoryBody(), {
    headers,
    tags: { name: 'stories/create' },
  })
  check(created, { 'stories/create 201': (r) => r.status === 201 })

  // Saving bumps the gamification refreshKey, so the same three scans run again
  // — now over one more story than before.
  const readHeaders = authHeader(user)
  http.batch([
    ['GET', `${BASE}/api/stats/overview?tz=${TZ}`, null, { headers: readHeaders, tags: { name: 'stats/overview' } }],
    ['GET', `${BASE}/api/stats/achievements?tz=${TZ}`, null, { headers: readHeaders, tags: { name: 'stats/achievements' } }],
    ['GET', `${BASE}/api/stats/challenges?tz=${TZ}`, null, { headers: readHeaders, tags: { name: 'stats/challenges' } }],
  ])

  sleep(1)
}
