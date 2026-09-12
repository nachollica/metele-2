import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearPendingInvite,
  readPendingInvite,
  writePendingInvite,
} from "@/lib/flowfic/pending-invite"

const KEY = "flowfic:pending-invite"
const HOUR_MS = 60 * 60 * 1000

// jsdom under Node 22 doesn't expose a working localStorage; back it with a
// simple in-memory Storage (same shim pending-story.test.ts uses).
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

beforeEach(() => {
  installMemoryStorage()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("pending invite round-trip", () => {
  it("stores and returns the token", () => {
    writePendingInvite("abc123")
    expect(readPendingInvite()).toBe("abc123")
  })

  it("overwrites an existing token", () => {
    writePendingInvite("first")
    writePendingInvite("second")
    expect(readPendingInvite()).toBe("second")
  })

  it("returns null once cleared", () => {
    writePendingInvite("abc123")
    clearPendingInvite()
    expect(readPendingInvite()).toBeNull()
  })

  it("returns null when nothing was ever stored", () => {
    expect(readPendingInvite()).toBeNull()
  })
})

describe("expiry", () => {
  it("drops and deletes a token older than the 1-hour TTL", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    writePendingInvite("abc123")

    vi.setSystemTime(new Date("2026-01-01T00:00:00Z").getTime() + 2 * HOUR_MS)

    expect(readPendingInvite()).toBeNull()
    // Deleted on read, so the check doesn't repeat on every boot.
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it("keeps a token that is still inside the window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    writePendingInvite("abc123")

    vi.setSystemTime(new Date("2026-01-01T00:00:00Z").getTime() + 30 * 60 * 1000)

    expect(readPendingInvite()).toBe("abc123")
  })
})

describe("malformed and stale rows", () => {
  it("drops a row that isn't JSON", () => {
    window.localStorage.setItem(KEY, "not json {")
    expect(readPendingInvite()).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it.each([
    ["a bare string", JSON.stringify("nope")],
    ["a missing token", JSON.stringify({ savedAt: Date.now() })],
    ["an empty token", JSON.stringify({ savedAt: Date.now(), token: "" })],
    ["a missing savedAt", JSON.stringify({ token: "abc123" })],
    ["a non-numeric savedAt", JSON.stringify({ token: "abc123", savedAt: "yesterday" })],
  ])("drops %s written by an older build", (_label, raw) => {
    window.localStorage.setItem(KEY, raw)
    expect(readPendingInvite()).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})

describe("when storage is unavailable", () => {
  it("reads as empty instead of throwing", () => {
    installBrokenStorage()
    expect(() => readPendingInvite()).not.toThrow()
    expect(readPendingInvite()).toBeNull()
  })

  it("swallows a failed write, so sign-in is never interrupted by it", () => {
    installBrokenStorage()
    expect(() => writePendingInvite("abc123")).not.toThrow()
    expect(() => clearPendingInvite()).not.toThrow()
  })
})
