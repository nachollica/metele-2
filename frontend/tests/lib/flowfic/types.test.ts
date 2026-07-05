import { describe, expect, it } from "vitest"

import {
  DEFAULT_SETTINGS,
  PRESETS,
  PRESET_KEYS,
  findMatchingPreset,
  type GameSettings,
} from "@/lib/flowfic/types"

describe("findMatchingPreset", () => {
  it("recognizes a fresh DEFAULT_SETTINGS as the 'classic' preset", () => {
    expect(findMatchingPreset(DEFAULT_SETTINGS)).toBe("classic")
  })

  it("matches every shipped preset when its values are applied verbatim", () => {
    for (const preset of PRESETS) {
      const settings: GameSettings = { ...DEFAULT_SETTINGS, ...preset.settings }
      expect(findMatchingPreset(settings)).toBe(preset.id)
    }
  })

  it("returns null when even one preset-covered key drifts", () => {
    const tweaked: GameSettings = {
      ...DEFAULT_SETTINGS,
      requiredWordIntervalSeconds: DEFAULT_SETTINGS.requiredWordIntervalSeconds + 1,
    }
    expect(findMatchingPreset(tweaked)).toBeNull()
  })

  it("ignores non-preset keys (e.g. bellEnabled) when matching", () => {
    const settings: GameSettings = { ...DEFAULT_SETTINGS, bellEnabled: false }
    expect(findMatchingPreset(settings)).toBe("classic")
    expect(PRESET_KEYS).not.toContain("bellEnabled")
  })
})
