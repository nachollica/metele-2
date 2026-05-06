import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getWordPool,
  matchesWord,
  normalizeForMatch,
  pickRequiredWord,
} from "@/lib/metele/words"

describe("normalizeForMatch", () => {
  it("strips diacritics and lowercases", () => {
    expect(normalizeForMatch("brújula")).toBe("brujula")
    expect(normalizeForMatch("MÁRMOL")).toBe("marmol")
    expect(normalizeForMatch("Año")).toBe("ano")
  })

  it("is idempotent on plain ASCII", () => {
    expect(normalizeForMatch("hello")).toBe("hello")
  })

  it("folds cedilla letters (ç → c)", () => {
    expect(normalizeForMatch("façade")).toBe("facade")
    expect(normalizeForMatch("Garçon")).toBe("garcon")
  })

  it("folds stroked / ligature / sharp letters that don't decompose", () => {
    expect(normalizeForMatch("łaska")).toBe("laska")
    expect(normalizeForMatch("Straße")).toBe("strasse")
    expect(normalizeForMatch("Ørsted")).toBe("orsted")
    expect(normalizeForMatch("œuvre")).toBe("oeuvre")
    expect(normalizeForMatch("Ægir")).toBe("aegir")
    expect(normalizeForMatch("Þórr")).toBe("thorr")
  })
})

describe("matchesWord", () => {
  it("matches case- and diacritic-insensitive variants", () => {
    expect(matchesWord("Brújula", "brujula")).toBe(true)
    expect(matchesWord("BRUJULA", "Brújula")).toBe(true)
  })

  it("strips surrounding punctuation/symbols on the candidate", () => {
    expect(matchesWord("¡Mármol!", "marmol")).toBe(true)
    expect(matchesWord("(stream),", "stream")).toBe(true)
  })

  it("rejects different words", () => {
    expect(matchesWord("ocean", "stream")).toBe(false)
    expect(matchesWord("streams", "stream")).toBe(false)
  })
})

describe("getWordPool", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a non-empty pool per supported locale", () => {
    expect(getWordPool("en").length).toBeGreaterThan(50)
    expect(getWordPool("es").length).toBeGreaterThan(50)
  })

  it("returns English with a warning for an unknown locale", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    // Bypass the locale type so the warning branch is exercised.
    const pool = getWordPool("fr" as unknown as "en")
    expect(pool).toBe(getWordPool("en"))
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe("pickRequiredWord", () => {
  it("returns a word from the locale's pool", () => {
    const word = pickRequiredWord("en")
    const pool = new Set(getWordPool("en"))
    expect(pool.has(word)).toBe(true)
  })

  it("avoids previously used words while alternatives remain", () => {
    const pool = getWordPool("en")
    const exclude = new Set(
      pool.slice(0, pool.length - 1).map((w) => normalizeForMatch(w)),
    )
    const remaining = pool[pool.length - 1]
    for (let i = 0; i < 10; i++) {
      expect(pickRequiredWord("en", exclude)).toBe(remaining)
    }
  })

  it("falls back to the full pool when every word is excluded", () => {
    const pool = getWordPool("en")
    const exclude = new Set(pool.map((w) => normalizeForMatch(w)))
    const word = pickRequiredWord("en", exclude)
    expect(pool).toContain(word)
  })
})
