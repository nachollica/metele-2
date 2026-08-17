import { describe, expect, it } from "vitest"

import { getTranslations } from "@/lib/i18n"
import {
  achievementText,
  achievementVisual,
  challengeText,
  challengeVisual,
  dailyIndex,
  dayOfYear,
  deltaIsPositive,
  deriveTitle,
  emptyOverview,
  EMPTY_LEVEL,
  formatCount,
  formatDelta,
  formatHoursMinutes,
  storyVisual,
  TONE_CHIP,
  zeroWeek,
} from "@/lib/flowfic/gamification"

describe("formatCount", () => {
  // Assert locale wiring against the same Intl call rather than a hardcoded
  // separator: grouping output depends on the runtime's ICU data (the test
  // Node may be small-icu), but the es→es-ES / en→en-US mapping must hold.
  it("formats through the matching BCP-47 locale", () => {
    expect(formatCount(3250, "es")).toBe(new Intl.NumberFormat("es-ES").format(3250))
    expect(formatCount(3250, "en")).toBe(new Intl.NumberFormat("en-US").format(3250))
  })
})

describe("formatHoursMinutes", () => {
  it("shows hours and minutes above an hour", () => {
    expect(formatHoursMinutes((6 * 60 + 15) * 60_000)).toBe("6h 15m")
  })
  it("drops the hour under 60 minutes", () => {
    expect(formatHoursMinutes(15 * 60_000)).toBe("15m")
    expect(formatHoursMinutes(0)).toBe("0m")
  })
})

describe("formatDelta / deltaIsPositive", () => {
  it("signs and rounds, and returns null without a baseline", () => {
    expect(formatDelta(12.4)).toBe("+12%")
    expect(formatDelta(-8.6)).toBe("-9%")
    expect(formatDelta(null)).toBeNull()
  })
  it("says nothing for a week that matched the last one", () => {
    // "+0%" beside an up-arrow claims progress that did not happen; no
    // indicator at all reads as "unchanged", which is the truth.
    expect(formatDelta(0)).toBeNull()
    expect(formatDelta(0.3)).toBeNull()
    expect(formatDelta(-0.4)).toBeNull()
  })
  it("keeps a genuine doubling or collapse", () => {
    expect(formatDelta(100)).toBe("+100%")
    expect(formatDelta(-100)).toBe("-100%")
  })
  it("treats null and negatives as not-positive", () => {
    expect(deltaIsPositive(0)).toBe(true)
    expect(deltaIsPositive(-1)).toBe(false)
    expect(deltaIsPositive(null)).toBe(false)
  })
})

describe("deriveTitle", () => {
  it("falls back for empty text", () => {
    expect(deriveTitle("   ", "Untitled")).toBe("Untitled")
  })
  it("takes the opening clause, capped to a few words", () => {
    expect(deriveTitle("The last traveler set out at dawn across the ridge.", "x")).toBe(
      "The last traveler set out at",
    )
  })
  it("stops at the first sentence break", () => {
    expect(deriveTitle("Hello world. Then more text.", "x")).toBe("Hello world")
  })
})

describe("dayOfYear / dailyIndex", () => {
  it("is stable within a day and wraps the pool", () => {
    const d = new Date(2026, 0, 11) // Jan 11 -> day 11
    expect(dayOfYear(d)).toBe(11)
    expect(dailyIndex(10, d)).toBe(1)
    expect(dailyIndex(0, d)).toBe(0)
  })
})

describe("empty states", () => {
  it("emptyOverview is all-zero at level 1", () => {
    const ov = emptyOverview()
    expect(ov.streak).toBe(0)
    expect(ov.totalWords).toBe(0)
    expect(ov.level).toEqual(EMPTY_LEVEL)
    expect(ov.chart).toHaveLength(7)
  })
  it("zeroWeek is 7 ascending zero days", () => {
    const week = zeroWeek()
    expect(week).toHaveLength(7)
    expect(week.every((p) => p.words === 0)).toBe(true)
    const dates = week.map((p) => p.date)
    expect([...dates].sort()).toEqual(dates) // already ascending
  })
})

describe("visuals", () => {
  it("storyVisual is deterministic for a seed", () => {
    expect(storyVisual(3)).toBe(storyVisual(3))
    expect(storyVisual("abc")).toBe(storyVisual("abc"))
  })
  it("known ids resolve, unknown ids fall back", () => {
    expect(achievementVisual("streak_7").tone).toBe("orange")
    expect(challengeVisual("daily_600").tone).toBe("violet")
    // unknown -> fallback, never throws
    expect(achievementVisual("nope").icon).toBeDefined()
    expect(challengeVisual("nope").icon).toBeDefined()
  })
  it("every tone has a chip class", () => {
    for (const tone of ["amber", "orange", "red", "green", "violet", "blue", "indigo"] as const) {
      expect(TONE_CHIP[tone]).toBeTruthy()
    }
  })
})

describe("localized text lookup", () => {
  const t = getTranslations("en")
  it("resolves known achievement/challenge ids", () => {
    expect(achievementText(t, "first_session").name).toBe("First step")
    expect(challengeText(t, "daily_600").name).toBe("Daily sprint")
  })
  it("falls back to the id for unknown keys", () => {
    expect(achievementText(t, "mystery")).toEqual({ name: "mystery", description: "" })
    expect(challengeText(t, "mystery")).toEqual({ name: "mystery", description: "" })
  })
})
