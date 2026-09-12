import { expect, test } from "@playwright/test"

import {
  DEV_USER,
  dismissWelcomeBeforeLoad,
  mockBackend,
  seedDevSession,
  seedPendingInvite,
  type StoryWire,
} from "./fixtures"

// Story privacy, the profile's connections card, and the /connect/:token
// screen — the three surfaces the user-connections feature added. Auth0 is
// never reachable in this suite (see fixtures.ts / playwright.config.ts), so
// the sign-in half of the connect screen only goes as far as opening the
// modal; the far side of that redirect is reproduced the same way
// anonymous-save.spec.ts does it — seed the pending record and a dev session,
// then reload, rather than clicking through a real Auth0 tenant.
test.use({ locale: "en-US" })

const ALICE = { id: "u-alice", name: "Alice", avatarUrl: null }

function library(): StoryWire[] {
  return [
    {
      id: 1,
      title: "The lighthouse keeper",
      text: "The lighthouse keeper counted the waves at dusk.",
      lang: "en",
      created_at: new Date().toISOString(),
      user_id: DEV_USER.id,
      privacy: "private",
      settings: {},
      stats: { words: 100 },
    },
  ]
}

test("changing a story's privacy from My stories persists across reload", async ({ page }) => {
  await mockBackend(page, { initialStories: library() })
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/stories")

  await page.getByRole("button", { name: "Visibility: Private" }).click()
  await page.getByRole("menuitemradio", { name: "Public" }).click()
  await expect(page.getByRole("button", { name: "Visibility: Public" })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("button", { name: "Visibility: Public" })).toBeVisible()
})

test("the connections card creates, regenerates, and disables an invite link", async ({
  page,
}) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/profile")

  await page.getByRole("button", { name: "Create invite link" }).click()
  const input = page.getByRole("textbox", { name: "Your invite link" })
  await expect(input).toHaveValue(/mock-invite-token-1$/)

  await page.getByRole("button", { name: "Regenerate" }).click()
  await expect(input).toHaveValue(/mock-invite-token-2$/)

  await page.getByRole("button", { name: "Disable" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Disable" })
    .click()
  await expect(page.getByRole("button", { name: "Create invite link" })).toBeVisible()
})

test("the connections card lists an existing connection and can remove it", async ({ page }) => {
  await mockBackend(page, {
    initialConnections: [{ user: ALICE, connectedAt: new Date().toISOString() }],
  })
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/profile")

  await expect(page.getByText("Alice")).toBeVisible()

  await page.getByRole("button", { name: "Remove Alice" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click()
  await expect(page.getByText("Alice")).toBeHidden()
  await expect(
    page.getByText("You have no connections yet. Share your invite link to connect with others."),
  ).toBeVisible()
})

test("an anonymous visitor is offered a sign-in naming the inviter", async ({ page }) => {
  // Clicking a provider hands the document over to Auth0 for real, which no
  // browser test can walk — same limit anonymous-save.spec.ts documents. This
  // stops at the modal; that `onBeforeLogin` writes the pending invite before
  // handing over is covered at the unit level (connect-screen.test.tsx).
  await mockBackend(page, { otherInvites: { "alice-token": ALICE } })
  await dismissWelcomeBeforeLoad(page)
  await page.goto("/connect/alice-token")

  await expect(page.getByText("Alice invited you to connect on Flowfic.")).toBeVisible()
  await page.getByRole("button", { name: "Sign in to connect" }).click()
  await expect(page.getByRole("heading", { name: "Connect on Flowfic" })).toBeVisible()
  await expect(
    page.getByText("Sign in or create an account to connect with Alice."),
  ).toBeVisible()
})

test("the far side of the redirect: a pending invite bounces the reboot to the connect screen", async ({
  page,
}) => {
  await mockBackend(page, { otherInvites: { "alice-token": ALICE } })
  await dismissWelcomeBeforeLoad(page)
  await seedPendingInvite(page, "alice-token")
  await seedDevSession(page)
  await page.goto("/")

  await expect(page).toHaveURL("/connect/alice-token")
  await expect(page.getByRole("button", { name: "Connect with Alice" })).toBeVisible()

  await page.getByRole("button", { name: "Connect with Alice" }).click()
  await expect(page.getByText("You're now connected with Alice.")).toBeVisible()

  await page.getByRole("button", { name: "Go to your connections" }).click()
  await expect(page).toHaveURL("/profile")
  await expect(page.getByText("Alice")).toBeVisible()
})

test("an authenticated visitor can connect directly from the link", async ({ page }) => {
  await mockBackend(page, { otherInvites: { "alice-token": ALICE } })
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/connect/alice-token")

  await page.getByRole("button", { name: "Connect with Alice" }).click()
  await expect(page.getByText("You're now connected with Alice.")).toBeVisible()
})

test("an unknown invite link shows an error instead of a blank screen", async ({ page }) => {
  await mockBackend(page)
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/connect/does-not-exist")

  await expect(page.getByText("This invite link isn't valid")).toBeVisible()
  // Scoped to `main`: the top bar's own back arrow shares this exact
  // accessible name.
  await page.getByRole("main").getByRole("button", { name: "Back to home" }).click()
  await expect(page).toHaveURL("/")
})

test("opening your own invite link says so instead of offering to connect", async ({ page }) => {
  await mockBackend(page, { initialOwnInviteToken: "my-own-token" })
  await dismissWelcomeBeforeLoad(page)
  await seedDevSession(page)
  await page.goto("/connect/my-own-token")

  await expect(page.getByText("This is your own invite link")).toBeVisible()
})
