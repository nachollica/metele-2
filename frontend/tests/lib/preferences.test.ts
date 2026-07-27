import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { readPrefs, storageKey } from "@/lib/preferences"

// `readPrefs` is the read/validate/migrate seam behind the preferences
// provider. These cover the word-sound migration: users stored a lone boolean
// `bellEnabled` before the setting grew a "bell" | "speak" mode.

// jsdom under Node 22 doesn't expose a working localStorage; back it with a
// simple in-memory Storage (same shim the auth tests use).
function installMemoryStorage(): void {
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
}

function seed(userId: string | null, raw: unknown) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(raw))
}

beforeEach(() => {
  installMemoryStorage()
})

afterEach(() => {
  window.localStorage.clear()
})

describe("readPrefs word-sound migration", () => {
  it("migrates a legacy `bellEnabled: true` to soundEnabled (mode left to default)", () => {
    seed(null, { bellEnabled: true })
    const prefs = readPrefs(null)
    expect(prefs.soundEnabled).toBe(true)
    expect(prefs.soundMode).toBeUndefined()
  })

  it("migrates a legacy `bellEnabled: false` to soundEnabled false", () => {
    seed(null, { bellEnabled: false })
    expect(readPrefs(null).soundEnabled).toBe(false)
  })

  it("prefers the new soundEnabled/soundMode keys over the legacy boolean", () => {
    seed("user-1", { bellEnabled: true, soundEnabled: false, soundMode: "speak" })
    const prefs = readPrefs("user-1")
    expect(prefs.soundEnabled).toBe(false)
    expect(prefs.soundMode).toBe("speak")
  })

  it("ignores an invalid soundMode value", () => {
    seed(null, { soundEnabled: true, soundMode: "chime" })
    const prefs = readPrefs(null)
    expect(prefs.soundEnabled).toBe(true)
    expect(prefs.soundMode).toBeUndefined()
  })

  it("returns an empty object when nothing is stored", () => {
    expect(readPrefs(null)).toEqual({})
  })
})
