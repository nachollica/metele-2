import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  INSPIRATION_VERSION,
  useInspiration,
  type InspirationImageData,
  type InspirationState,
} from "@/lib/flowfic/inspiration"

// The shared "current pick" store (module singletons + useSyncExternalStore) is
// mocked out wherever the panel is tested, so its real behaviour — loading the
// catalog once, persisting the pick per session, and re-rolling on refresh —
// lives only here. Vitest isolates modules per test file, so the singletons
// start clean for this file.

const STORAGE_KEY = `flowfic:inspiration:v${INSPIRATION_VERSION}`

const CATALOG = [
  { loc: "https://film-grab.test/a", img: "https://img.test/a.jpg" },
  { loc: "https://film-grab.test/b", img: "https://img.test/b.jpg" },
]
  .map((record) => JSON.stringify(record))
  .join("\n")

function readImage(state: InspirationState): InspirationImageData | null {
  return state.status === "ready" ? state.image : null
}

describe("useInspiration (shared store)", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, text: async () => CATALOG }) as Response),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("loads the catalog, persists the pick, and re-rolls to a different film on refresh", async () => {
    const { result } = renderHook(() => useInspiration())

    // Resolves from loading to a concrete pick, persisted so a reload restores it.
    await waitFor(() => expect(result.current.state.status).toBe("ready"))
    const first = readImage(result.current.state)
    expect(first).not.toBeNull()
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe(first?.loc)

    // Refresh re-rolls; with two films in the pool the pick must change, and the
    // new choice is re-persisted.
    act(() => {
      result.current.refresh()
    })
    await waitFor(() => expect(readImage(result.current.state)?.loc).not.toBe(first?.loc))
    const second = readImage(result.current.state)
    expect(second).not.toBeNull()
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe(second?.loc)

    // The catalog is fetched at most once across the initial load + refresh.
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
