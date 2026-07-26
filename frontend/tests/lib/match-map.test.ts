import { afterEach, describe, expect, it, vi } from "vitest"

import {
  isInflectionMatch,
  isRegularPlural,
  loadMatchMap,
  type MatchMap,
} from "@/lib/flowfic/match-map"

// A tiny synthetic map: gato/gata/gatos share a group, alto/alta share another,
// palo and pala are distinct groups (look-alikes).
const MAP: MatchMap = new Map([
  ["gato", 0],
  ["gata", 0],
  ["gatos", 0],
  ["alto", 1],
  ["alta", 1],
  ["palo", 2],
  ["pala", 3],
])

describe("isRegularPlural", () => {
  it("matches regular plurals in both languages", () => {
    expect(isRegularPlural("gato", "gatos", "es")).toBe(true)
    expect(isRegularPlural("plan", "planes", "es")).toBe(true)
    expect(isRegularPlural("luz", "luces", "es")).toBe(true) // z → ces
    expect(isRegularPlural("run", "runs", "en")).toBe(true)
    expect(isRegularPlural("city", "cities", "en")).toBe(true) // y → ies
    expect(isRegularPlural("leaf", "leaves", "en")).toBe(true) // f → ves
    expect(isRegularPlural("knife", "knives", "en")).toBe(true) // fe → ves
  })

  it("does not treat look-alikes or equal words as plurals", () => {
    expect(isRegularPlural("palo", "pala", "es")).toBe(false)
    expect(isRegularPlural("gato", "gato", "es")).toBe(false)
    expect(isRegularPlural("", "s", "en")).toBe(false)
  })
})

describe("isInflectionMatch", () => {
  it("matches inflections and gender via the group map", () => {
    expect(isInflectionMatch("gata", "gato", "es", MAP)).toBe(true)
    expect(isInflectionMatch("gatos", "gato", "es", MAP)).toBe(true)
    expect(isInflectionMatch("alta", "alto", "es", MAP)).toBe(true)
  })

  it("keeps look-alikes and unrelated words apart", () => {
    expect(isInflectionMatch("palo", "pala", "es", MAP)).toBe(false)
    expect(isInflectionMatch("gato", "perro", "es", MAP)).toBe(false)
  })

  it("matches exactly regardless of case, accents, and edge punctuation", () => {
    expect(isInflectionMatch("¡GATO!", "gato", "es", MAP)).toBe(true)
    expect(isInflectionMatch("brújula", "brujula", "es", MAP)).toBe(true)
  })

  it("still handles exact + plural when the map is unavailable", () => {
    expect(isInflectionMatch("gatos", "gato", "es", null)).toBe(true) // plural rule
    expect(isInflectionMatch("gato", "gato", "es", null)).toBe(true) // exact
    // gender needs the map; without it, it must not match.
    expect(isInflectionMatch("gata", "gato", "es", null)).toBe(false)
  })
})

describe("loadMatchMap", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches and parses the versioned map (locale 'en')", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ dog: 5, dogs: 5 }), { status: 200 })),
    )
    const map = await loadMatchMap("en")
    expect(map?.get("dog")).toBe(5)
    expect(map?.get("dogs")).toBe(5)
  })

  it("resolves to null when the map is unavailable (locale 'es')", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    )
    expect(await loadMatchMap("es")).toBeNull()
  })
})
