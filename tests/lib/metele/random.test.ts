import { afterEach, describe, expect, it, vi } from "vitest"

import { randomIntervalMs } from "@/lib/metele/random"

describe("randomIntervalMs", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("clamps low samples to the 0.5s floor", () => {
    // Math.random() near 1 yields -ln(~1)/lambda ≈ 0 → clamped to 0.5s
    vi.spyOn(Math, "random").mockReturnValue(0.999999)
    expect(randomIntervalMs(30)).toBe(500)
  })

  it("clamps high samples to the 60s ceiling", () => {
    // Math.random() near 0 → -ln(0+) = ∞ → clamped to 60s
    vi.spyOn(Math, "random").mockReturnValue(1e-10)
    expect(randomIntervalMs(30)).toBe(60_000)
  })

  it("returns u-derived values in between for normal samples", () => {
    // u = e^-1 ≈ 0.3679 → -ln(u)/lambda = 1/lambda = averageSeconds
    vi.spyOn(Math, "random").mockReturnValue(Math.exp(-1))
    expect(randomIntervalMs(30)).toBeCloseTo(30_000, 0)
  })

  it("respects the configured average across many samples", () => {
    // Empirical mean of ~10k draws should land near `averageSeconds`. Generous
    // tolerance because clamping skews the tails.
    let total = 0
    const N = 5_000
    const target = 5
    for (let i = 0; i < N; i++) total += randomIntervalMs(target)
    const meanSeconds = total / N / 1000
    expect(meanSeconds).toBeGreaterThan(target * 0.6)
    expect(meanSeconds).toBeLessThan(target * 1.4)
  })
})
