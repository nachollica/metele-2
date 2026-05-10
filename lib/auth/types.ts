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
  customPresets: CustomPreset[]
}

// User-defined session preset. Mirrors the backend `CustomPreset` model
// (`backend/app/models.py`). Stored as a JSON list on the user row;
// settings are validated at the API boundary against `PresetSettings`,
// which corresponds to `PresetSettings` in `lib/metele/types.ts`.
export type CustomPreset = {
  id: string
  name: string
  settings: import("@/lib/metele/types").PresetSettings
}

// Hard cap on user-defined presets. Mirrors `MAX_CUSTOM_PRESETS` in the
// backend — also dictates the number of slots the settings screen draws.
export const MAX_CUSTOM_PRESETS = 5
