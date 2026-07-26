import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
  MATCH_MAP_VERSION,
  isInflectionMatch,
  type MatchMap,
} from "@/lib/flowfic/match-map"

// Guard the real committed match maps against the real matcher, so a rebuild
// that regresses inflection grouping (or drops a look-alike apart) fails here.
const here = path.dirname(fileURLToPath(import.meta.url))

function loadReal(locale: "en" | "es"): MatchMap {
  const file = path.join(here, "..", "..", "public", "match-map", `${locale}.v${MATCH_MAP_VERSION}.json`)
  const obj = JSON.parse(readFileSync(file, "utf8")) as Record<string, number>
  return new Map(Object.entries(obj))
}

const es = loadReal("es")
const en = loadReal("en")

const ES_MATCH: ReadonlyArray<[string, string]> = [
  ["gatos", "gato"],
  ["gata", "gato"],
  ["alta", "alto"],
  ["nueva", "nuevo"],
  ["planes", "plan"],
  ["aviones", "avión"],
  ["flores", "flor"],
  ["luces", "luz"],
]
const ES_NO: ReadonlyArray<[string, string]> = [
  ["palo", "pala"],
  ["banco", "banca"],
  ["foco", "foca"],
  ["puerto", "puerta"],
  ["gato", "pato"],
]
const EN_MATCH: ReadonlyArray<[string, string]> = [
  ["dogs", "dog"],
  ["cities", "city"],
  ["leaves", "leaf"],
  ["children", "child"],
  ["runs", "run"],
]
const EN_NO: ReadonlyArray<[string, string]> = [
  ["plane", "planet"],
  ["cat", "car"],
  ["angel", "angle"],
]

describe("committed match map (es)", () => {
  it.each(ES_MATCH)("%s satisfies required %s", (a, b) => {
    expect(isInflectionMatch(a, b, "es", es)).toBe(true)
  })
  it.each(ES_NO)("%s does NOT satisfy %s", (a, b) => {
    expect(isInflectionMatch(a, b, "es", es)).toBe(false)
  })
})

describe("committed match map (en)", () => {
  it.each(EN_MATCH)("%s satisfies required %s", (a, b) => {
    expect(isInflectionMatch(a, b, "en", en)).toBe(true)
  })
  it.each(EN_NO)("%s does NOT satisfy %s", (a, b) => {
    expect(isInflectionMatch(a, b, "en", en)).toBe(false)
  })
})
