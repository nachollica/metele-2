import { act, renderHook, waitFor } from "@testing-library/react"
import type { ChangeEvent, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LocaleContext } from "@/lib/i18n"
import { readPendingStory, writePendingStory } from "@/lib/flowfic/pending-story"
import { useGameEngine } from "@/lib/flowfic/use-game-engine"
import { DEFAULT_SETTINGS } from "@/lib/flowfic/types"
import type { AuthContextValue } from "@/lib/auth"
import type { CreateStoryInput, Story } from "@/lib/flowfic/stories-api"

// The draft half of the engine: what it stores when a sprint ends, and what it
// does with that store on each way out. Everything here runs with required
// words disabled, which is the one `startGame` branch that plays immediately
// instead of awaiting a word pool and a match map.

const authState: { current: AuthContextValue } = { current: makeAuth() }

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "authenticated",
    user: null,
    loginWithProvider: vi.fn().mockResolvedValue(undefined),
    loginAsDevUser: vi.fn().mockResolvedValue({ ok: false, reason: "error" as const }),
    logout: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue("tok"),
    applyLocalUser: vi.fn(),
    ...overrides,
  }
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return { ...actual, useAuth: () => authState.current }
})

vi.mock("@/lib/preferences", () => ({
  usePreferences: () => ({
    soundEnabled: false,
    setSoundEnabled: vi.fn(),
    soundMode: "bell" as const,
    setSoundMode: vi.fn(),
  }),
}))

const createStory = vi.hoisted(() => vi.fn())
vi.mock("@/lib/flowfic/stories-api", () => ({ createStory }))

vi.mock("@/lib/flowfic/sound", () => ({
  primeAudio: vi.fn(),
  playBell: vi.fn(),
  speakWord: vi.fn(),
}))

vi.mock("@/lib/flowfic/inspiration", () => ({ clearInspiration: vi.fn() }))

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

function wrapper({ children }: { children: ReactNode }) {
  return <LocaleContext value="en">{children}</LocaleContext>
}

function savedStory(id = 7): Story {
  return {
    id,
    title: null,
    text: "The lighthouse had been dark for three winters.",
    lang: "en",
    createdAt: "2026-09-11T10:00:00Z",
    userId: "google-oauth2|abc",
    settings: {},
    stats: {},
  }
}

// Drive a hook to the "ended with text" state: start, type (which arms the
// timers), then quit.
function playAndEnd(result: { current: ReturnType<typeof useGameEngine> }, text: string): void {
  act(() => {
    result.current.startGame({ ...DEFAULT_SETTINGS, requiredWordIntervalEnabled: false })
  })
  act(() => {
    result.current.handleChange({
      target: { value: text, selectionStart: text.length },
    } as ChangeEvent<HTMLTextAreaElement>)
  })
  act(() => {
    result.current.quit()
  })
}

const STORY_TEXT = "The lighthouse had been dark for three winters."

beforeEach(() => {
  installMemoryStorage()
  authState.current = makeAuth()
  createStory.mockReset()
  createStory.mockResolvedValue(savedStory())
})

describe("storing the draft", () => {
  it("writes the finished story to storage as soon as the sprint ends", () => {
    const { result } = renderHook(() => useGameEngine(), { wrapper })

    playAndEnd(result, STORY_TEXT)

    const pending = readPendingStory()
    expect(pending?.payload.text).toBe(STORY_TEXT)
    // endGame runs before the title field even exists, so it can only ever
    // store an untitled draft.
    expect(pending?.payload.title).toBeNull()
    expect(pending?.intent).toBe(false)
  })

  it("stores nothing when the player quits without writing anything", () => {
    const { result } = renderHook(() => useGameEngine(), { wrapper })

    act(() => {
      result.current.startGame({ ...DEFAULT_SETTINGS, requiredWordIntervalEnabled: false })
    })
    act(() => {
      result.current.quit()
    })

    expect(readPendingStory()).toBeNull()
  })

  it("captures a title typed in the epilogue when an exit refreshes the draft", () => {
    const { result } = renderHook(() => useGameEngine(), { wrapper })
    playAndEnd(result, STORY_TEXT)

    act(() => {
      result.current.setStoryTitle("The dark lighthouse")
    })
    act(() => {
      result.current.persistPendingStory()
    })

    expect(readPendingStory()?.payload.title).toBe("The dark lighthouse")
  })
})

describe("saving", () => {
  it("clears the draft once the story reaches the backend", async () => {
    const { result } = renderHook(() => useGameEngine(), { wrapper })
    playAndEnd(result, STORY_TEXT)

    act(() => {
      result.current.saveCurrentStoryIfNeeded()
    })

    await waitFor(() => expect(readPendingStory()).toBeNull())
    expect(createStory).toHaveBeenCalledTimes(1)
  })

  it("keeps the draft and stays silent when there is nobody to save for", async () => {
    authState.current = makeAuth({
      status: "anonymous",
      getAccessToken: vi.fn().mockResolvedValue(null),
    })
    const { result } = renderHook(() => useGameEngine(), { wrapper })
    playAndEnd(result, STORY_TEXT)

    act(() => {
      result.current.saveCurrentStoryIfNeeded()
    })

    await waitFor(() => expect(createStory).not.toHaveBeenCalled())
    expect(readPendingStory()?.payload.text).toBe(STORY_TEXT)
    // The failure alert means "the request failed"; an anonymous player never
    // made one, and a Retry button here could never succeed.
    expect(result.current.failedSave).toBeNull()
  })

  it("raises the failure alert and keeps the draft when the request fails", async () => {
    createStory.mockResolvedValue(null)
    const { result } = renderHook(() => useGameEngine(), { wrapper })
    playAndEnd(result, STORY_TEXT)

    act(() => {
      result.current.saveCurrentStoryIfNeeded()
    })

    await waitFor(() => expect(result.current.failedSave).not.toBeNull())
    expect(readPendingStory()?.payload.text).toBe(STORY_TEXT)
  })

  it("clears both the alert and the draft when a retry succeeds", async () => {
    createStory.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useGameEngine(), { wrapper })
    playAndEnd(result, STORY_TEXT)

    act(() => {
      result.current.saveCurrentStoryIfNeeded()
    })
    await waitFor(() => expect(result.current.failedSave).not.toBeNull())

    createStory.mockResolvedValue(savedStory())
    act(() => {
      result.current.retryFailedSave()
    })

    await waitFor(() => expect(result.current.failedSave).toBeNull())
    expect(readPendingStory()).toBeNull()
  })
})

describe("discarding", () => {
  it("drops the draft and returns to idle", () => {
    const { result } = renderHook(() => useGameEngine(), { wrapper })
    playAndEnd(result, STORY_TEXT)
    expect(readPendingStory()).not.toBeNull()

    act(() => {
      result.current.discardAndReset()
    })

    expect(readPendingStory()).toBeNull()
    expect(result.current.gameState).toBe("idle")
    expect(result.current.hasUnsavedStory()).toBe(false)
  })
})

describe("restoring a draft from an earlier session", () => {
  function draft(): CreateStoryInput {
    return {
      title: "Recovered",
      text: STORY_TEXT,
      lang: "en",
      settings: DEFAULT_SETTINGS,
      stats: {
        reason: "global",
        durationMs: 600_000,
        characters: STORY_TEXT.length,
        words: 8,
        requiredWordsUsed: 2,
      },
    }
  }

  it("posts the stored draft, clears it, and returns the created story", async () => {
    writePendingStory(draft(), true)
    const { result } = renderHook(() => useGameEngine(), { wrapper })

    let created: Story | null = null
    await act(async () => {
      created = await result.current.restorePendingStory()
    })

    expect(createStory).toHaveBeenCalledWith("tok", expect.objectContaining({ title: "Recovered" }))
    expect(created).not.toBeNull()
    expect(readPendingStory()).toBeNull()
  })

  it("returns null when there is nothing stored", async () => {
    const { result } = renderHook(() => useGameEngine(), { wrapper })

    let created: Story | null = null
    await act(async () => {
      created = await result.current.restorePendingStory()
    })

    expect(created).toBeNull()
    expect(createStory).not.toHaveBeenCalled()
  })

  it("leaves the draft in place when the request fails, so it can be retried", async () => {
    createStory.mockResolvedValue(null)
    writePendingStory(draft(), true)
    const { result } = renderHook(() => useGameEngine(), { wrapper })

    await act(async () => {
      await result.current.restorePendingStory()
    })

    expect(readPendingStory()?.payload.text).toBe(STORY_TEXT)
  })
})
