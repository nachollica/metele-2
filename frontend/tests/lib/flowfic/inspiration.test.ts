import { describe, expect, it } from "vitest"

import { deriveTitle, parseInspirationJsonl } from "@/lib/flowfic/inspiration"

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
