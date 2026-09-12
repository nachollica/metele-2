// A connect-link token held in localStorage across a sign-in redirect.
//
// Opening someone's `/connect/:token` link while anonymous means the visitor
// picks a provider from the connect screen's own login modal, which — like
// every login — is a full-page redirect (`loginWithProvider` replaces the
// document, and the Auth0 callback replaces it again). `appState.returnTo` is
// hardcoded to `/` for every login everywhere in the app, so the token itself
// would be lost across that round trip without a bridge. This is that bridge:
// on the far side, the shell reads it back and navigates to the same connect
// screen, where the visitor still has to press "Connect" themselves — nothing
// is accepted automatically. This is deliberately simpler than
// `pending-story.ts`: there is no "intent" flag (only one path ever writes a
// pending invite) and no recovery modal (the connect screen the token points
// back to already *is* the confirmation).

const STORAGE_KEY = "flowfic:pending-invite"

// Generous but short: this only needs to outlive one Auth0 round trip, not a
// player's whole session. Long past this window the token is dropped without
// ever redirecting — a stale tab reopened days later shouldn't bounce the
// player to a half-remembered invite screen.
const TTL_MS = 60 * 60 * 1000

type PendingInvite = {
  token: string
  savedAt: number
}

function isValid(value: unknown): value is PendingInvite {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.token !== "string" || record.token.length === 0) return false
  return typeof record.savedAt === "number" && Number.isFinite(record.savedAt)
}

/**
 * The stored invite token, or null when there is none, it is unreadable, or
 * it has aged past the TTL. An expired record is deleted on read so the check
 * doesn't repeat on every boot.
 */
export function readPendingInvite(): string | null {
  if (typeof window === "undefined") return null
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearPendingInvite()
    return null
  }
  if (!isValid(parsed)) {
    clearPendingInvite()
    return null
  }
  if (Date.now() - parsed.savedAt > TTL_MS) {
    clearPendingInvite()
    return null
  }
  return parsed.token
}

/** Called just before a provider redirect from the connect screen. */
export function writePendingInvite(token: string): void {
  if (typeof window === "undefined") return
  const record: PendingInvite = { token, savedAt: Date.now() }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Quota exceeded or storage disabled — the token just won't survive the
    // redirect; the visitor lands on the home screen instead of back here.
  }
}

export function clearPendingInvite(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do — a record we cannot delete is one we could not read
    // either.
  }
}
