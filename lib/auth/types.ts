// Shared auth types. Mirrors the FastAPI backend's response shapes so the
// frontend can stay strictly typed.

export type AuthProvider = "google" | "instagram" | "facebook"

export const AUTH_PROVIDERS: readonly AuthProvider[] = [
  "google",
  "instagram",
  "facebook",
] as const

export type AuthUser = {
  id: string
  provider: AuthProvider
  email: string | null
  name: string
  avatarUrl: string | null
}

export type AuthSession = {
  user: AuthUser
  token: string
}
