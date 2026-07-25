import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  browserTimeZone,
  fetchAchievements,
  fetchChallenges,
  fetchOverview,
} from "@/lib/flowfic/stats-api"

describe("stats-api", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("browserTimeZone returns a non-empty string", () => {
    expect(browserTimeZone().length).toBeGreaterThan(0)
  })

  it("fetchOverview hits /stats/overview with a bearer token and tz param", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ streak: 3 }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchOverview("tok")
    expect(result).toEqual({ streak: 3 })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toContain("/api/stats/overview?tz=")
    const headers = (init as RequestInit).headers as Headers
    expect(headers.get("Authorization")).toBe("Bearer tok")
  })

  it("achievements and challenges parse arrays", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: "first_session" }] }),
    )
    expect(await fetchAchievements("tok")).toEqual([{ id: "first_session" }])
    expect(await fetchChallenges("tok")).toEqual([{ id: "first_session" }])
  })

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect(await fetchOverview("tok")).toBeNull()
  })

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")))
    expect(await fetchOverview("tok")).toBeNull()
  })
})
