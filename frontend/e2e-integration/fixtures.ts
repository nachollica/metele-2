import path from "node:path"
import { DatabaseSync } from "node:sqlite"

import { expect, type APIRequestContext, type Page } from "@playwright/test"

// Helpers for the real-backend integration lane. The API base is the isolated
// backend the integration config boots (see playwright.integration.config.ts).
const API_URL = "http://localhost:8001"

// The throwaway SQLite DB `just e2e-serve` creates. The lane always runs from
// the frontend dir (Playwright loads specs as CommonJS, so no import.meta), so
// resolve it from process.cwd().
const DB_PATH = path.resolve(process.cwd(), "..", "backend", ".e2e", "e2e.db")

export type DbStory = { id: number; title: string | null; text: string }

/**
 * Drive the actual dev-login UI (the backdoor button the real backend enables
 * via GET /ping) and wait until the session is authenticated.
 */
export async function devLoginViaUi(page: Page, username = "e2e"): Promise<void> {
  await page.getByRole("button", { name: /dev user login/i }).click()
  await page.getByLabel(/dev username/i).fill(username)
  await page.getByRole("button", { name: /log in as dev user/i }).click()
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible()
}

/** Mint a dev bearer token straight from the backend, for API-level assertions. */
export async function getDevToken(request: APIRequestContext, username = "e2e"): Promise<string> {
  const res = await request.post(`${API_URL}/api/auth/dev-login`, { data: { username } })
  expect(res.ok(), `dev-login failed: ${res.status()}`).toBeTruthy()
  const body = (await res.json()) as { token: string }
  return body.token
}

/** The caller's stories as the real API returns them. */
export async function apiStories(
  request: APIRequestContext,
  token: string,
): Promise<Array<{ id: number; title: string | null; text: string }>> {
  const res = await request.get(`${API_URL}/api/stories`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.ok(), `list stories failed: ${res.status()}`).toBeTruthy()
  const body = (await res.json()) as {
    items: Array<{ id: number; title: string | null; text: string }>
  }
  return body.items
}

/**
 * Read the `stories` rows for a user straight out of the SQLite file — the
 * belt-and-suspenders DB check that bypasses the API entirely.
 */
export function dbStoriesForUser(userId: string): DbStory[] {
  const db = new DatabaseSync(DB_PATH, { readOnly: true })
  try {
    const rows = db.prepare("SELECT id, title, text FROM stories WHERE user_id = ?").all(userId)
    return rows.map((r) => ({
      id: Number(r.id),
      title: r.title === null ? null : String(r.title),
      text: String(r.text),
    }))
  } finally {
    db.close()
  }
}
