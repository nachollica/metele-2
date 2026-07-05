import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  fetchRandomWords,
  fetchRelatedWords,
  parseCategoriesInput,
} from "@/lib/flowfic/words-api"

describe("parseCategoriesInput", () => {
  it("splits on commas, trims, lowercases and drops empties", () => {
    expect(parseCategoriesInput("Food, Kitchen ,  ,RESTAURANTS")).toEqual([
      "food",
      "kitchen",
      "restaurants",
    ])
  })

  it("de-duplicates while preserving first occurrence", () => {
    expect(parseCategoriesInput("dog, Dog, cat, dog")).toEqual(["dog", "cat"])
  })

  it("returns an empty array for blank input", () => {
    expect(parseCategoriesInput("   ")).toEqual([])
  })
})

describe("fetchRandomWords", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("POSTs /words/random with the locale and limit and returns the pool", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ language: "en", words: ["oven", "galaxy"] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchRandomWords("tok", "en", 50)
    expect(result).toEqual(["oven", "galaxy"])

    const [calledUrl, init] = fetchMock.mock.calls[0] ?? []
    expect(calledUrl).toBe("http://localhost:8000/api/words/random")
    expect((init as RequestInit).method).toBe("POST")
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ language: "en", limit: 50 }),
    )
  })

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect(await fetchRandomWords("tok", "es")).toBeNull()
  })

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")))
    expect(await fetchRandomWords("tok", "en")).toBeNull()
  })

  it("returns null when the words field is not an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ language: "en" }) }),
    )
    expect(await fetchRandomWords("tok", "en")).toBeNull()
  })
})

describe("fetchRelatedWords", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns null without calling the backend when there are no seeds", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await fetchRelatedWords("tok", [], "en")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("POSTs /words/related with seeds, locale and limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ language: "en", words: ["fork", "plate"] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchRelatedWords("tok", ["kitchen"], "en", 80)
    expect(result).toEqual(["fork", "plate"])

    const [calledUrl, init] = fetchMock.mock.calls[0] ?? []
    expect(calledUrl).toBe("http://localhost:8000/api/words/related")
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ words: ["kitchen"], language: "en", limit: 80 }),
    )
  })
})
