import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearPendingStory,
  markPendingStoryIntent,
  readPendingStory,
  writePendingStory,
} from "@/lib/flowfic/pending-story"
import type { CreateStoryInput } from "@/lib/flowfic/stories-api"
import { DEFAULT_SETTINGS } from "@/lib/flowfic/types"

const KEY = "flowfic:pending-story"
const DAY_MS = 24 * 60 * 60 * 1000

// jsdom under Node 22 doesn't expose a working localStorage; back it with a
// simple in-memory Storage (same shim the preferences/auth tests use).
function installMemoryStorage(): Storage {
  const map = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => {
      map.delete(k)
    },
    setItem: (k, v) => {
      map.set(k, String(v))
    },
  }
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true })
  return storage
}

// Storage that throws on every operation, standing in for private mode or a
// browser with storage blocked outright.
function installBrokenStorage(): void {
  const boom = () => {
    throw new Error("storage disabled")
  }
  const storage = {
    get length(): number {
      return boom()
    },
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  } as unknown as Storage
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true })
}

function payload(overrides: Partial<CreateStoryInput> = {}): CreateStoryInput {
  return {
    title: null,
    text: "The lighthouse had been dark for three winters.",
    lang: "en",
    settings: DEFAULT_SETTINGS,
    stats: {
      reason: "manual",
      durationMs: 60_000,
      characters: 46,
      words: 8,
      requiredWordsUsed: 1,
    },
    ...overrides,
  }
}

beforeEach(() => {
  installMemoryStorage()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("pending story round-trip", () => {
  it("stores and returns a draft, defaulting intent to false", () => {
    writePendingStory(payload())

    const stored = readPendingStory()
    expect(stored?.payload.text).toBe("The lighthouse had been dark for three winters.")
    expect(stored?.intent).toBe(false)
    expect(typeof stored?.savedAt).toBe("number")
  })

  it("overwrites the draft so a title typed in the epilogue is captured", () => {
    writePendingStory(payload())
    writePendingStory(payload({ title: "The dark lighthouse" }))

    expect(readPendingStory()?.payload.title).toBe("The dark lighthouse")
  })

  it("returns null once cleared", () => {
    writePendingStory(payload())
    clearPendingStory()

    expect(readPendingStory()).toBeNull()
  })

  it("returns null when nothing was ever stored", () => {
    expect(readPendingStory()).toBeNull()
  })
})

describe("the intent flag", () => {
  it("is sticky: re-writing the draft does not demote an intent-flagged one", () => {
    // Otherwise refreshing the draft on the way out of the game would quietly
    // turn "sign me in to save this" back into "ask me about it later".
    writePendingStory(payload(), true)
    writePendingStory(payload({ title: "Renamed" }))

    const stored = readPendingStory()
    expect(stored?.intent).toBe(true)
    expect(stored?.payload.title).toBe("Renamed")
  })

  it("is set by markPendingStoryIntent on an existing draft", () => {
    writePendingStory(payload())
    markPendingStoryIntent()

    expect(readPendingStory()?.intent).toBe(true)
  })

  it("does nothing when there is no draft to mark", () => {
    markPendingStoryIntent()

    expect(readPendingStory()).toBeNull()
  })
})

describe("expiry", () => {
  it("drops and deletes a draft older than the 7-day TTL", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    writePendingStory(payload())

    vi.setSystemTime(new Date("2026-01-01T00:00:00Z").getTime() + 8 * DAY_MS)

    expect(readPendingStory()).toBeNull()
    // Deleted on read, so the check doesn't repeat on every boot.
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it("keeps a draft that is still inside the window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    writePendingStory(payload())

    vi.setSystemTime(new Date("2026-01-01T00:00:00Z").getTime() + 6 * DAY_MS)

    expect(readPendingStory()?.payload.text).toContain("lighthouse")
  })
})

describe("malformed and stale rows", () => {
  it("drops a row that isn't JSON", () => {
    window.localStorage.setItem(KEY, "not json {")

    expect(readPendingStory()).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it.each([
    ["a bare string", JSON.stringify("nope")],
    ["a missing payload", JSON.stringify({ savedAt: Date.now(), intent: false })],
    ["an empty story text", JSON.stringify({ savedAt: Date.now(), intent: false, payload: payload({ text: "   " }) })],
    ["a non-boolean intent", JSON.stringify({ savedAt: Date.now(), intent: "yes", payload: payload() })],
    ["a missing savedAt", JSON.stringify({ intent: false, payload: payload() })],
  ])("drops %s written by an older build", (_label, raw) => {
    window.localStorage.setItem(KEY, raw)

    expect(readPendingStory()).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})

describe("when storage is unavailable", () => {
  it("reads as empty instead of throwing", () => {
    installBrokenStorage()

    expect(() => readPendingStory()).not.toThrow()
    expect(readPendingStory()).toBeNull()
  })

  it("swallows a failed write, so the game is never interrupted by it", () => {
    installBrokenStorage()

    expect(() => writePendingStory(payload())).not.toThrow()
    expect(() => clearPendingStory()).not.toThrow()
  })
})
