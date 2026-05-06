// Shared auth types. The frontend relies on Auth0 for issuance; the backend
// validates Auth0 access tokens and stores its own canonical user record
// (this is the shape returned by `GET /auth/me`).

// Connections we let the user pick directly from the login modal. The keys
// are the project-internal ids; `AUTH0_CONNECTION` (in `client.ts`) maps
// them to the Auth0 social connection names that get passed to
// `loginWithRedirect`.
//
// Instagram is intentionally absent — Auth0 does not expose it as a built-in
// social connection (per the project requirement to drop unsupported ones).
export type AuthProvider = "google" | "facebook" | "twitter"

export const AUTH_PROVIDERS: readonly AuthProvider[] = [
  "google",
  "facebook",
  "twitter",
] as const

// Mirrors the FastAPI `AuthUser` model (with the `avatarUrl` alias on the
// wire). The backend keeps these fields populated from the Auth0 /userinfo
// payload on first sign-in.
export type AuthUser = {
  id: string
  email: string | null
  name: string
  avatarUrl: string | null
}
