"use client"

// Recovery helpers for the Auth0 SPA token machinery.
//
// The SDK serializes silent token refreshes with a cross-tab lock stored in
// localStorage (via the bundled `browser-tabs-lock` library) under keys
// prefixed with `browser-tabs-lock-key`. If a tab is closed or reloaded mid
// refresh, the lock can be left behind. A stale lock makes every subsequent
// `getAccessTokenSilently()` that needs a refresh block for the full 5s
// acquire timeout and then throw — which our `getAccessToken` wrapper turns
// into a null token, breaking data loads with no request ever sent.
//
// Clearing these keys is safe: they are ephemeral coordination state, not
// tokens. `logout()` clears the token cache but leaves these lock keys behind,
// and clearing browser cookies never touches localStorage — which is why a
// wedged lock survives logout/login and cookie clearing alike.
const LOCK_KEY_PREFIX = "browser-tabs-lock-key"

export function clearAuth0Locks(): void {
  if (typeof window === "undefined") return
  try {
    const stale: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key !== null && key.startsWith(LOCK_KEY_PREFIX)) stale.push(key)
    }
    for (const key of stale) window.localStorage.removeItem(key)
  } catch {
    // localStorage unavailable (private mode / disabled) — nothing to clear.
  }
}
