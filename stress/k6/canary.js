// A real browser loading the app, alongside (or before) the protocol load.
//
// This is deliberately *not* a way to generate load — a headless Chromium costs
// a few hundred megabytes and real CPU per instance, so it tops out at
// single-digit concurrency on any of these hosts. What it adds is the thing
// plain HTTP cannot show: the genuine request fan-out a page triggers, the
// browser's own caching and connection reuse, and user-perceived timings.
//
// The number that matters is the *difference* between an idle baseline and the
// same measurement under load. Absolute figures carry the generator's distance
// to the origin; the delta does not.

import { browser } from 'k6/browser'
import { check } from 'k6'

import { config } from './lib/config.js'

const BASE = config.baseUrl

export const options = {
  scenarios: {
    canary: {
      executor: 'shared-iterations',
      // A handful of sequential loads: enough to see a median, few enough that
      // the canary never becomes part of the load it is measuring.
      vus: 1,
      iterations: Number(config.canaryIterations || 5),
      maxDuration: '5m',
      options: {
        browser: { type: 'chromium' },
      },
      tags: { probe: 'canary' },
    },
  },
  // Availability only, matching the protocol run: the canary reports timings,
  // it does not adjudicate them.
  thresholds: {
    checks: ['rate>0.90'],
  },
}

export default async function () {
  const page = await browser.newPage()
  try {
    // `networkidle` rather than `load`: this app renders client-side and then
    // fetches its data assets, so `load` would fire while the match map — the
    // heaviest thing on the page — was still in flight.
    const response = await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    check(response, { 'shell 200': (r) => r !== null && r.status() === 200 })

    // The landing must actually render, not merely return bytes. A 200 that
    // paints nothing is exactly what the stale-bind-mount outage looked like
    // from a plain HTTP check.
    //
    // The count is awaited *before* `check` rather than inside it: `check`
    // takes a synchronous predicate, so an async one hands it a pending promise
    // — always truthy — and the assertion silently never runs.
    const headingCount = await page.locator('h1, h2').count()
    check(headingCount, { 'app rendered': (count) => count > 0 })

    // Navigation timings, read from the page itself. These are what a real
    // visitor experiences, and the only figures here that a protocol-level run
    // cannot produce at all.
    const timings = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0]
      const paint = performance.getEntriesByType('paint')
      const fcp = paint.find((entry) => entry.name === 'first-contentful-paint')
      return {
        ttfb: nav ? Math.round(nav.responseStart) : 0,
        domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
        loadEvent: nav ? Math.round(nav.loadEventEnd) : 0,
        fcp: fcp ? Math.round(fcp.startTime) : 0,
        transferredKb: nav ? Math.round((nav.transferSize || 0) / 1024) : 0,
      }
    })

    console.log(
      `canary ttfb=${timings.ttfb}ms fcp=${timings.fcp}ms ` +
        `dcl=${timings.domContentLoaded}ms load=${timings.loadEvent}ms`,
    )
  } finally {
    await page.close()
  }
}
