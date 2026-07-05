import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createCustomPreset,
  deleteCustomPreset,
  updateCustomPreset,
} from "@/lib/flowfic/presets-api"
import type { PresetSettings } from "@/lib/flowfic/types"

// Guards the wire contract: preset CRUD lives under /profile/me/presets on the
// backend (the /auth router only exposes /auth/me and /auth/dev-login). A
// mismatch here 404s silently for every logged-in user.

const SETTINGS: PresetSettings = {
  mainTimerSeconds: 7,
  globalTimerEnabled: true,
  globalTimerSeconds: 300,
  requiredWordIntervalEnabled: true,
  requiredWordIntervalSeconds: 30,
  requiredWordUseTimerEnabled: true,
  requiredWordUseTimerSeconds: 25,
}

function okUser() {
  return { id: "u", name: "U", email: null, avatarUrl: null, customPresets: [] }
}

function stubFetch() {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => okUser() })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("presets-api", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("POSTs new presets to /api/profile/me/presets", async () => {
    const fetchMock = stubFetch()
    await createCustomPreset("tok", "Sprint", SETTINGS)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("http://localhost:8000/api/profile/me/presets")
    expect((init as RequestInit).method).toBe("POST")
  })

  it("PATCHes a preset by id under /api/profile/me/presets/:id", async () => {
    const fetchMock = stubFetch()
    await updateCustomPreset("tok", "abc 1", { name: "Renamed" })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("http://localhost:8000/api/profile/me/presets/abc%201")
    expect((init as RequestInit).method).toBe("PATCH")
  })

  it("DELETEs a preset by id under /api/profile/me/presets/:id", async () => {
    const fetchMock = stubFetch()
    await deleteCustomPreset("tok", "xyz")

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("http://localhost:8000/api/profile/me/presets/xyz")
    expect((init as RequestInit).method).toBe("DELETE")
  })
})
