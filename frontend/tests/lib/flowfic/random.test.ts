import { afterEach, describe, expect, it, vi } from "vitest"

import { randomIntervalMs } from "@/lib/flowfic/random"

describe("randomIntervalMs", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns exactly min (half average) when random is 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(randomIntervalMs(30)).toBe(15_000)
  })

  it("returns exactly max (double average) when random is 0.999...", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999)
    // 30 / 2 + 0.999999 * (60 - 15) = 15 + 44.999955 = 59.999955s
    expect(randomIntervalMs(30)).toBeCloseTo(60_000, -1)
  })

  it("respects the configured average across many samples", () => {
    let total = 0
    const N = 5_000
    const target = 10 // target average in seconds
    for (let i = 0; i < N; i++) total += randomIntervalMs(target)
    const meanSeconds = total / N / 1000
    // With Beta(2, 4), the mean should be extremely close to the target.
    expect(meanSeconds).toBeGreaterThan(target * 0.95)
    expect(meanSeconds).toBeLessThan(target * 1.05)
  })
})
