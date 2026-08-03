import { describe, expect, it } from "vitest"

import {
  parseQuotesJsonl,
  quoteBlocks,
  quoteOfTheDay,
  quoteTitle,
  type Quote,
} from "@/lib/flowfic/quotes"

const LINE = JSON.stringify({
  id: "a-0001",
  author: "A. Author",
  source: "A Book",
  kind: "statement",
  lang_source: "en",
  origin: { file: "x", md5: "y", char_start: 0, char_end: 1 },
  text: { en: ["Hello."], es: ["Hola."] },
})

describe("parseQuotesJsonl", () => {
  it("parses one object per non-blank line", () => {
    const body = `${LINE}\n\n${LINE}\n`
    const quotes = parseQuotesJsonl(body)
    expect(quotes).toHaveLength(2)
    expect(quotes[0].id).toBe("a-0001")
  })

  it("returns an empty array for a blank body", () => {
    expect(parseQuotesJsonl("\n  \n")).toEqual([])
  })
})

describe("quoteOfTheDay", () => {
  const quotes = parseQuotesJsonl(`${LINE}\n${LINE.replace("a-0001", "a-0002")}`)

  it("is stable within a day and rotates by day of year", () => {
    expect(quoteOfTheDay(quotes, new Date(2026, 0, 2))?.id).toBe("a-0001") // day 2 % 2 = 0
    expect(quoteOfTheDay(quotes, new Date(2026, 0, 3))?.id).toBe("a-0002") // day 3 % 2 = 1
  })

  it("returns null for an empty pool", () => {
    expect(quoteOfTheDay([])).toBeNull()
  })
})

describe("quoteBlocks", () => {
  const quote = parseQuotesJsonl(LINE)[0]

  it("returns the requested locale's blocks", () => {
    expect(quoteBlocks(quote, "es")).toEqual(["Hola."])
  })

  it("falls back to the source language when the locale is missing", () => {
    const enOnly: Quote = { ...quote, text: { en: ["Only English."] } }
    expect(quoteBlocks(enOnly, "es")).toEqual(["Only English."])
  })
})

describe("quoteTitle", () => {
  const quote = parseQuotesJsonl(LINE)[0]

  it("returns the translated title when present", () => {
    const withEs: Quote = { ...quote, source_i18n: { es: "Un Libro" } }
    expect(quoteTitle(withEs, "es")).toBe("Un Libro")
  })

  it("falls back to the source title when the locale has no translation", () => {
    expect(quoteTitle(quote, "es")).toBe("A Book")
    const withEs: Quote = { ...quote, source_i18n: { es: "Un Libro" } }
    expect(quoteTitle(withEs, "en")).toBe("A Book")
  })
})
