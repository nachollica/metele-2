// Email-shape guardrail for the profile-edit panel (the only place a user
// types an email — auth is social-login only, so there is no email signup or
// login form).
//
// This is a cheap pre-flight check so the UI can short-circuit obviously
// malformed input before a network round-trip. The authoritative validation
// runs server-side (`backend/app/email_validation.py` — disposable blocklist
// + `email-validator`), so this regex intentionally errs on the side
// of permissive: anything that *might* be a real address gets accepted here
// and the backend has the final say.

// Conservative shape: <non-space, non-@>@<non-space, non-@>.<tld>.
// HTML5 inputs already get a similar check from `type="email"`, but submit
// can still be triggered without the browser's native validation (e.g.
// pressing Enter on a populated field on some browsers), and we want a
// programmatic check we can also call from the profile-edit panel.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Mirrors the backend ``Field(max_length=320)`` on the profile-update payload
// — the RFC-effective upper bound on full address length. Used so the UI's
// max-length and the server reject at the same threshold.
export const MAX_EMAIL_LENGTH = 320

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) return false
  return EMAIL_PATTERN.test(trimmed)
}
