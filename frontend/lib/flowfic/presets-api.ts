// Client for the backend `/profile/me/presets` endpoints.
//
// All endpoints return the freshly mutated `AuthUser` so callers can
// overlay the auth context with `applyLocalUser` in one shot.

import { apiFetch } from "@/lib/auth/client"
import type { AuthUser } from "@/lib/auth"
import type { PresetSettings } from "@/lib/flowfic/types"

type PresetMutationError = "limit" | "validation" | "not-found" | "unknown"

// Response shape: codes (4xx) are encoded as `error` so the UI can
// distinguish "limit reached" from "network down" without parsing strings.
export type PresetMutationResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: PresetMutationError }

function classifyError(status: number): PresetMutationError {
  if (status === 409) return "limit"
  if (status === 422 || status === 400) return "validation"
  if (status === 404) return "not-found"
  return "unknown"
}

async function call(
  token: string,
  path: string,
  init: RequestInit,
): Promise<PresetMutationResult> {
  try {
    const res = await apiFetch(token, path, init)
    if (!res.ok) {
      return { ok: false, error: classifyError(res.status) }
    }
    const user = (await res.json()) as AuthUser
    return { ok: true, user }
  } catch (err) {
    console.warn("[presets-api] unreachable", err)
    return { ok: false, error: "unknown" }
  }
}

export async function createCustomPreset(
  token: string,
  name: string,
  settings: PresetSettings,
): Promise<PresetMutationResult> {
  return call(token, "/profile/me/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, settings }),
  })
}

export async function updateCustomPreset(
  token: string,
  id: string,
  patch: { name?: string; settings?: PresetSettings },
): Promise<PresetMutationResult> {
  return call(token, `/profile/me/presets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
}

export async function deleteCustomPreset(
  token: string,
  id: string,
): Promise<PresetMutationResult> {
  return call(token, `/profile/me/presets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
