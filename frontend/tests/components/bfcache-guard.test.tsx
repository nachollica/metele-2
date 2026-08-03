import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BfcacheGuard } from "@/components/bfcache-guard"
import { authRedirectState } from "@/lib/auth/client"

function firePageShow(persisted: boolean) {
  const event = new Event("pageshow") as PageTransitionEvent
  Object.defineProperty(event, "persisted", { value: persisted })
  window.dispatchEvent(event)
}

function stubReload() {
  const reload = vi.fn()
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload },
  })
  return reload
}

describe("BfcacheGuard", () => {
  beforeEach(() => {
    authRedirectState.inFlight = false
  })
  afterEach(() => {
    authRedirectState.inFlight = false
    vi.restoreAllMocks()
  })

  it("reloads when a page frozen mid auth-redirect is restored (persisted + inFlight)", () => {
    const reload = stubReload()
    authRedirectState.inFlight = true
    render(<BfcacheGuard />)
    firePageShow(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("does NOT reload on a bfcache restore that was not an auth redirect", () => {
    const reload = stubReload()
    // inFlight stays false: an ordinary bfcache restore (e.g. cross-document
    // back) must not blow away the page. In-app section nav is same-document
    // popstate and never reaches this guard at all.
    render(<BfcacheGuard />)
    firePageShow(true)
    expect(reload).not.toHaveBeenCalled()
  })

  it("does not reload on a normal (non-persisted) load, even mid auth-redirect", () => {
    const reload = stubReload()
    authRedirectState.inFlight = true
    render(<BfcacheGuard />)
    firePageShow(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it("removes the listener on unmount", () => {
    const reload = stubReload()
    authRedirectState.inFlight = true
    const { unmount } = render(<BfcacheGuard />)
    unmount()
    firePageShow(true)
    expect(reload).not.toHaveBeenCalled()
  })
})
