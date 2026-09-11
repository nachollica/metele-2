// A finished story held in localStorage until it can reach the backend.
//
// Signing in is a full-page redirect (`loginWithProvider` replaces the
// document, and the Auth0 callback replaces it again), so a story that only
// exists in React state cannot survive an anonymous player deciding to sign in
// and save it. This module is the bridge across those reloads.
//
// Two rules shape the whole design:
//
//  1. The draft is only ever POSTed as a finished story. It is NEVER written
//     back into the editor, so a new sprint always starts on a blank page and
//     a player can't be ambushed by text they wrote (and forgot about) hours
//     ago.
//  2. A draft only saves itself unprompted when `intent` is set, i.e. the
//     player clicked a provider in the "sign in to save this story" modal.
//     Every other draft is offered through the recovery modal instead, so an
//     unrelated sign-in days later never silently resurrects old work.

import type { CreateStoryInput } from "@/lib/flowfic/stories-api"

const STORAGE_KEY = "flowfic:pending-story"

// How long a draft stays offerable. It matters more than it looks: past this
// window the draft is dropped without ever being mentioned, which is what
// stops a months-old story from prompting on a routine sign-in.
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export type PendingStory = {
  payload: CreateStoryInput
  /** Epoch ms the draft was last written; drives both the TTL and the age
   *  shown in the recovery modal. */
  savedAt: number
  /** True once the player asked to sign in *in order to* save this story.
   *  Only an intent-flagged draft is saved without asking again. */
  intent: boolean
}

// Storage is attacker-adjacent only in the sense that it survives deploys: a
// draft written by an older build can have a shape this one no longer accepts.
// Validate rather than trusting the cast, or a stale row becomes a crash on
// boot for every returning player.
function isValid(value: unknown): value is PendingStory {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.savedAt !== "number" || !Number.isFinite(record.savedAt)) return false
  if (typeof record.intent !== "boolean") return false
  const payload = record.payload
  if (typeof payload !== "object" || payload === null) return false
  const p = payload as Record<string, unknown>
  if (typeof p.text !== "string" || p.text.trim().length === 0) return false
  if (p.title !== null && typeof p.title !== "string") return false
  if (typeof p.lang !== "string") return false
  if (typeof p.settings !== "object" || p.settings === null) return false
  if (typeof p.stats !== "object" || p.stats === null) return false
  return true
}

/**
 * The stored draft, or null when there is none, it is unreadable, or it has
 * aged past the TTL. An expired draft is deleted on read so the check doesn't
 * repeat on every boot.
 */
export function readPendingStory(): PendingStory | null {
  if (typeof window === "undefined") return null
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage disabled (private mode, blocked cookies): no draft, no crash.
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearPendingStory()
    return null
  }
  if (!isValid(parsed)) {
    clearPendingStory()
    return null
  }
  if (Date.now() - parsed.savedAt > TTL_MS) {
    clearPendingStory()
    return null
  }
  return parsed
}

/**
 * Store (or overwrite) the draft. Called when a sprint ends and again on every
 * intercepted exit, so a title typed in the epilogue is captured whichever way
 * the player leaves.
 *
 * `intent` is sticky: once a player has chosen "sign in to save this story",
 * re-writing the draft must not quietly demote it back to needing a prompt.
 */
export function writePendingStory(payload: CreateStoryInput, intent = false): void {
  if (typeof window === "undefined") return
  const existing = intent ? null : readPendingStory()
  const record: PendingStory = {
    payload,
    savedAt: Date.now(),
    intent: intent || existing?.intent === true,
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Quota exceeded or storage disabled. The draft just won't survive the
    // redirect — the in-memory copy is still on screen until the player leaves.
  }
}

/** Mark the existing draft as "the player is signing in to save this one". */
export function markPendingStoryIntent(): void {
  const existing = readPendingStory()
  if (existing === null) return
  writePendingStory(existing.payload, true)
}

export function clearPendingStory(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do — a draft we cannot delete is one we could not read either.
  }
}
