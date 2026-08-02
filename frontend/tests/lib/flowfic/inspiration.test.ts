import { afterEach, describe, expect, it, vi } from "vitest"

import {
  chooseNext,
  parseInspirationJsonl,
  type InspirationImageData,
} from "@/lib/flowfic/inspiration"

const LINE = JSON.stringify({
  title: "And The Ship Sails On",
  page: "https://film-grab.com/2014/12/12/and-the-ship-sails-on/",
  image: "https://film-grab.com/wp-content/uploads/And-The-Ship-01.jpg",
})

describe("parseInspirationJsonl", () => {
  it("parses one object per non-blank line", () => {
    const images = parseInspirationJsonl(`${LINE}\n\n${LINE}\n`)
    expect(images).toHaveLength(2)
    expect(images[0].title).toBe("And The Ship Sails On")
  })

  it("returns an empty array for a blank body", () => {
    expect(parseInspirationJsonl("\n  \n")).toEqual([])
  })
})

describe("chooseNext", () => {
  const pool: InspirationImageData[] = [
    { title: "A", page: "p-a", image: "i-a" },
    { title: "B", page: "p-b", image: "i-b" },
    { title: "C", page: "p-c", image: "i-c" },
  ]

  afterEach(() => vi.restoreAllMocks())

  it("returns the sole entry for a one-item pool", () => {
    expect(chooseNext([pool[0]], "p-a")).toBe(pool[0])
  })

  it("never returns the current page when alternatives exist", () => {
    // Force Math.random to first land on the current page, then move on.
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.5)
    expect(chooseNext(pool, "p-a").page).toBe("p-b")
  })

  it("picks by index from Math.random", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9)
    expect(chooseNext(pool).page).toBe("p-c") // floor(0.9 * 3) = 2
  })
})
