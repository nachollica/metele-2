// Protocol-level load against the deployed Flowfic stack.
//
// Run through the harness, never by hand:
//     just stress::run --profile load --rate 8 --mix sprint=20
//
// The harness parses every flag, seeds the population these journeys
// authenticate as, and passes the result in as FLOWFIC_CONFIG.

import { config, buildScenarios, buildThresholds } from './lib/config.js'
import {
  anon as runAnon,
  landing as runLanding,
  sprint as runSprint,
  stories as runStories,
  finish as runFinish,
  discoverAssets,
  setAssets,
} from './lib/journeys.js'

export const options = {
  scenarios: buildScenarios(config),
  thresholds: buildThresholds(config),
  // Reroutes the connection without touching the Host header, so the request
  // still presents as flowfic.app and Caddy's site block still matches. Empty
  // when going through the CDN, where normal DNS is the point.
  hosts: config.hosts,
  // The origin serves a Cloudflare Origin certificate, which is not signed by a
  // public root — it is only trusted by Cloudflare itself. Going straight to the
  // origin therefore has to skip verification; this is not a transport we are
  // testing, and the alternative is shipping CF's origin CA around.
  insecureSkipTLSVerify: true,
  // One connection reused across a VU's iterations, as a browser would. Without
  // this every iteration pays a fresh TLS handshake, which measures the
  // generator's CPU more than the server's.
  noConnectionReuse: false,
  userAgent: 'flowfic-stress/0.1 (+load-test harness)',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

/**
 * Discover the chunk graph once, before any load starts.
 *
 * Next.js content-hashes every asset name, so hardcoding them would break on
 * the next deploy. Doing it here rather than per-iteration also keeps the cost
 * out of the measurement.
 */
export function setup() {
  const assets = discoverAssets()
  if (assets.length === 0) {
    throw new Error('No static chunks found in index.html — is the site serving the shell?')
  }
  console.log(`Discovered ${assets.length} static assets; ${config.userCount} seeded users.`)
  return { assets }
}

// Each scenario's `exec` names one of these, so the export names have to match
// the journey keys exactly. Each hands the setup-discovered asset list to the
// module the journeys read it from: every VU gets its own module instance, so
// the list cannot simply be assigned once at init.
export function anon(data) {
  setAssets(data.assets)
  runAnon()
}

export function landing(data) {
  setAssets(data.assets)
  runLanding()
}

export function sprint(data) {
  setAssets(data.assets)
  runSprint()
}

export function stories(data) {
  setAssets(data.assets)
  runStories()
}

export function finish(data) {
  setAssets(data.assets)
  runFinish()
}
