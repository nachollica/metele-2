import { describe, expect, it } from "vitest"

import { filterAndSortStories } from "@/lib/flowfic/story-search"
import type { Story } from "@/lib/flowfic/stories-api"

function story(id: number, over: Partial<Story> = {}): Story {
  return {
    id,
    title: null,
    text: `story ${id}`,
    lang: "en",
    createdAt: new Date(2026, 0, id).toISOString(), // Jan {id}, 2026 (local)
    userId: "u",
    settings: {},
    stats: {},
    ...over,
  }
}

describe("filterAndSortStories", () => {
  it("orders by newest / oldest when there is no query", () => {
    const list = [story(1), story(3), story(2)]
    expect(
      filterAndSortStories(list, { query: "", from: null, to: null, sort: "newest" }).map(
        (s) => s.id,
      ),
    ).toEqual([3, 2, 1])
    expect(
      filterAndSortStories(list, { query: "", from: null, to: null, sort: "oldest" }).map(
        (s) => s.id,
      ),
    ).toEqual([1, 2, 3])
  })

  it("filters by an inclusive date range (by local day)", () => {
    const list = [story(1), story(2), story(3), story(4)]
    const res = filterAndSortStories(list, {
      query: "",
      from: new Date(2026, 0, 2),
      to: new Date(2026, 0, 3),
      sort: "newest",
    })
    expect(res.map((s) => s.id)).toEqual([3, 2])
  })

  it("fuzzy-searches text, dropping non-matches", () => {
    const list = [
      story(1, { text: "..." }),
      story(2, { text: "a story about a lighthouse keeper" }),
      story(3, { text: "unrelated content" }),
    ]
    const ids = filterAndSortStories(list, {
      query: "lighthouse",
      from: null,
      to: null,
      sort: "newest",
    }).map((s) => s.id)
    expect(ids).toContain(2)
    expect(ids).not.toContain(3)
  })

  it("matches a story by its explicit title", () => {
    const list = [story(1, { title: "Kafka in the Rain" }), story(2, { text: "nothing here" })]
    const res = filterAndSortStories(list, {
      query: "kafka",
      from: null,
      to: null,
      sort: "newest",
    })
    expect(res[0]?.id).toBe(1)
  })

  it("tolerates a null title during search", () => {
    const list = [story(1, { title: null, text: "the quiet harbor" })]
    const res = filterAndSortStories(list, {
      query: "harbor",
      from: null,
      to: null,
      sort: "newest",
    })
    expect(res.map((s) => s.id)).toEqual([1])
  })
})
