import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  INSPIRATION_VERSION,
  resetInspirationStoreForTests,
  useInspiration,
} from "@/lib/flowfic/inspiration"
import { resetQuotesCacheForTests } from "@/lib/flowfic/quotes"

// The shared "current pick" store (module singletons + useSyncExternalStore) is
// mocked out wherever the components are tested, so its real behaviour — the
// unset resting state, the 50/50 image-or-quote coin flip, session persistence,
// and clearing — lives only here.

const STORAGE_KEY = `flowfic:inspiration:v${INSPIRATION_VERSION}`

// On-disk shape: FILM_GRAB_PREFIX is stripped from both fields (reconstructed
// on parse), so the fixture uses bare relative paths.
const CATALOG = [
  { loc: "2020/01/01/a/", img: "wp-content/a.jpg" },
  { loc: "2020/01/02/b/", img: "wp-content/b.jpg" },
]
  .map((record) => JSON.stringify(record))
  .join("\n")

const QUOTES = [
  {
    id: "q-1",
    author: "A",
    source: "S",
    kind: "statement",
    lang_source: "en",
    origin: { file: "f", md5: "m", char_start: 0, char_end: 1 },
    text: { en: ["one"] },
  },
  {
    id: "q-2",
    author: "B",
    source: "T",
    kind: "statement",
    lang_source: "en",
    origin: { file: "f", md5: "m", char_start: 0, char_end: 1 },
    text: { en: ["two"] },
  },
]
  .map((record) => JSON.stringify(record))
  .join("\n")

// Both pools are fetched by path; answer each with its own fixture.
function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.includes("/quotes/") ? QUOTES : CATALOG
      return { ok: true, text: async () => body } as Response
    }),
  )
}

describe("useInspiration (shared store)", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    // Both pools memoize their fetch, so drop those caches too — otherwise a
    // later test's stub is never consulted.
    resetInspirationStoreForTests()
    resetQuotesCacheForTests()
    stubFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("starts unset — nothing is picked until the user asks for it", () => {
    const { result } = renderHook(() => useInspiration())
    expect(result.current.state.status).toBe("unset")
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("picks an image when the coin flip lands low, and persists it", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const { result } = renderHook(() => useInspiration())

    act(() => result.current.pick())
    await waitFor(() => expect(result.current.state.status).toBe("image"))

    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY)!)
    expect(stored.kind).toBe("image")
    if (result.current.state.status !== "image") throw new Error("expected an image")
    expect(stored.loc).toBe(result.current.state.image.loc)
  })

  it("picks a quote when the coin flip lands high, and persists it", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9)
    const { result } = renderHook(() => useInspiration())

    act(() => result.current.pick())
    await waitFor(() => expect(result.current.state.status).toBe("quote"))

    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY)!)
    expect(stored.kind).toBe("quote")
    if (result.current.state.status !== "quote") throw new Error("expected a quote")
    expect(stored.id).toBe(result.current.state.quote.id)
  })

  it("clearing drops the pick and its stored entry", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const { result } = renderHook(() => useInspiration())

    act(() => result.current.pick())
    await waitFor(() => expect(result.current.state.status).toBe("image"))

    act(() => result.current.clear())
    expect(result.current.state.status).toBe("unset")
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("reports unavailable when neither pool loads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, text: async () => "" }) as Response),
    )
    const { result } = renderHook(() => useInspiration())

    act(() => result.current.pick())
    await waitFor(() => expect(result.current.state.status).toBe("unavailable"))
  })
})
