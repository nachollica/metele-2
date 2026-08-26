// Run configuration, handed in as one JSON blob so the Python harness stays the
// single place that parses and validates flags. k6 evaluates this at init time,
// which is what lets `options` below be computed rather than hardcoded.

/** @returns {object} the harness-supplied configuration */
export function loadConfig() {
  const raw = __ENV.FLOWFIC_CONFIG
  if (!raw) {
    throw new Error('FLOWFIC_CONFIG is unset — run this through `just stress::run`.')
  }
  return JSON.parse(raw)
}

export const config = loadConfig()

// Relative journey weights become per-scenario arrival rates: the total rate is
// `--rate`, split proportionally. Keeping them relative (rather than as
// percentages) means `--mix sprint=0` silences one journey without changing
// what the others do.
export function journeyRates(cfg) {
  const total = Object.values(cfg.mix).reduce((a, b) => a + b, 0)
  const rates = {}
  for (const [name, weight] of Object.entries(cfg.mix)) {
    rates[name] = total === 0 ? 0 : (cfg.rate * weight) / total
  }
  return rates
}

// One `ramping-arrival-rate` scenario per journey. The open model is the point:
// arrivals are held at the target regardless of how slow the server becomes,
// where a fixed pool of virtual users would throttle itself as latency rose and
// quietly report a healthy box.
//
// Rates are expressed per *minute* because k6 requires `stages.target` to be a
// whole number. Splitting a per-second rate across five journeys lands on
// fractions almost immediately (a 3% journey at 10/s is 0.3/s), which k6
// rejects outright; per minute the same split is 18, and the resolution is
// finer rather than coarser.
const TIME_UNIT_SECONDS = 60

export function buildScenarios(cfg) {
  const rates = journeyRates(cfg)
  const scenarios = {}

  for (const [name, ratePerSecond] of Object.entries(rates)) {
    if (ratePerSecond <= 0) continue

    const ratePerMinute = ratePerSecond * TIME_UNIT_SECONDS
    const stages = cfg.stages.map(([duration, multiplier]) => ({
      duration,
      target: Math.max(0, Math.round(ratePerMinute * multiplier)),
    }))

    const peakPerMinute = Math.max(...stages.map((s) => s.target))
    // A journey whose share rounds away entirely would otherwise register a
    // scenario that never fires — drop it rather than report it as running.
    if (peakPerMinute <= 0) continue

    const peakPerSecond = peakPerMinute / TIME_UNIT_SECONDS
    scenarios[name] = {
      executor: 'ramping-arrival-rate',
      exec: name,
      startRate: 0,
      timeUnit: '1m',
      // Headroom so the executor can meet its arrival rate while earlier
      // requests are still in flight. Sized off the peak rate against a
      // pessimistic response time; too few VUs and k6 quietly under-delivers
      // the load it claims to be generating.
      preAllocatedVUs: Math.max(4, Math.ceil(peakPerSecond * 4)),
      maxVUs: Math.max(16, Math.ceil(peakPerSecond * 20)),
      stages,
      tags: { journey: name },
    }
  }

  if (Object.keys(scenarios).length === 0) {
    throw new Error(
      'Every journey resolved to a zero arrival rate — raise --rate or the mix weights.',
    )
  }
  return scenarios
}

// Every endpoint the journeys tag. Listed here because k6 only *computes* a
// tagged sub-metric when a threshold names it — without an entry per endpoint,
// the exported summary carries totals only and the report cannot say which call
// was slow.
const TAGGED_ENDPOINTS = [
  'index.html',
  'chunk',
  'match-map',
  'inspiration',
  'ping',
  'auth/me',
  'stats/overview',
  'stats/achievements',
  'stats/challenges',
  'words/related',
  'words/random',
  'stories/list',
  'stories/count',
  'stories/detail',
  'stories/create',
]

// Availability only, by choice: this hardware has no established latency
// baseline, so a p95 target would be a guess that either never fires or fires
// constantly. Errors and timeouts are unambiguous, and on a 954MB box falling
// over is the actual risk. Latency is recorded per endpoint and reported.
export function buildThresholds(cfg) {
  const thresholds = {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  }
  for (const name of Object.keys(cfg.mix)) {
    thresholds[`http_req_failed{journey:${name}}`] = ['rate<0.02']
  }
  // `max>=0` holds for any observation, so these enforce nothing — they exist
  // purely to make k6 materialise the per-endpoint breakdown. Putting a real
  // latency bound here would quietly turn this into a latency gate, which is
  // exactly what the availability-only choice above rules out.
  for (const endpoint of TAGGED_ENDPOINTS) {
    thresholds[`http_req_duration{name:${endpoint}}`] = ['max>=0']
  }
  return thresholds
}
