import { afterEach, describe, expect, it, vi } from "vitest"

import {
  chooseNext,
  deriveTitle,
  parseInspirationJsonl,
  type InspirationImageData,
} from "@/lib/flowfic/inspiration"

// On-disk shape: FILM_GRAB_PREFIX is stripped from both fields.
const LINE = JSON.stringify({
  loc: "2014/12/12/and-the-ship-sails-on/",
  img: "wp-content/uploads/And-The-Ship-01.jpg",
})

describe("deriveTitle", () => {
  it("turns the last slug into space-separated words (left lower-case)", () => {
    expect(deriveTitle("https://film-grab.com/2014/12/12/and-the-ship-sails-on/")).toBe(
      "and the ship sails on",
    )
  })

  it("tolerates a missing trailing slash", () => {
    expect(deriveTitle("https://film-grab.com/2024/04/15/stopmotion")).toBe("stopmotion")
  })
})

describe("parseInspirationJsonl", () => {
  it("parses one object per non-blank line, reconstructing full URLs and the title", () => {
    const images = parseInspirationJsonl(`${LINE}\n\n${LINE}\n`)
    expect(images).toHaveLength(2)
    expect(images[0]).toEqual({
      title: "and the ship sails on",
      loc: "https://film-grab.com/2014/12/12/and-the-ship-sails-on/",
      img: "https://film-grab.com/wp-content/uploads/And-The-Ship-01.jpg",
    })
  })

  it("returns an empty array for a blank body", () => {
    expect(parseInspirationJsonl("\n  \n")).toEqual([])
  })
})

describe("chooseNext", () => {
  const pool: InspirationImageData[] = [
    { title: "a", loc: "p-a", img: "i-a" },
    { title: "b", loc: "p-b", img: "i-b" },
    { title: "c", loc: "p-c", img: "i-c" },
  ]

  afterEach(() => vi.restoreAllMocks())

  it("returns the sole entry for a one-item pool", () => {
    expect(chooseNext([pool[0]], "p-a")).toBe(pool[0])
  })

  it("never returns the current loc when alternatives exist", () => {
    // Force Math.random to first land on the current loc, then move on.
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.5)
    expect(chooseNext(pool, "p-a").loc).toBe("p-b")
  })

  it("picks by index from Math.random", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9)
    expect(chooseNext(pool).loc).toBe("p-c") // floor(0.9 * 3) = 2
  })
})
