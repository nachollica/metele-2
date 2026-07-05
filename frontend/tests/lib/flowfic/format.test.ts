import { describe, expect, it } from "vitest"

import { formatSeconds } from "@/lib/flowfic/format"

const UNITS = { seconds: "s", minutes: "m" }

describe("formatSeconds", () => {
  it("formats sub-minute durations as Xs", () => {
    expect(formatSeconds(0, UNITS)).toBe("0s")
    expect(formatSeconds(7, UNITS)).toBe("7s")
    expect(formatSeconds(59, UNITS)).toBe("59s")
  })

  it("ceils fractional seconds (so countdowns show '1s' until they hit 0)", () => {
    expect(formatSeconds(0.4, UNITS)).toBe("1s")
    expect(formatSeconds(7.05, UNITS)).toBe("8s")
  })

  it("clamps negatives to 0", () => {
    expect(formatSeconds(-12, UNITS)).toBe("0s")
  })

  it("rolls into minutes once the value reaches 60s", () => {
    expect(formatSeconds(60, UNITS)).toBe("1m")
    expect(formatSeconds(67, UNITS)).toBe("1m 7s")
    expect(formatSeconds(120, UNITS)).toBe("2m")
    expect(formatSeconds(78 * 60 + 13, UNITS)).toBe("78m 13s")
  })

  it("uses caller-provided unit suffixes for i18n", () => {
    expect(formatSeconds(125, { seconds: "seg", minutes: "min" })).toBe(
      "2min 5seg",
    )
  })
})
