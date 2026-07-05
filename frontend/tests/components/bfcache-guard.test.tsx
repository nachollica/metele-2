import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BfcacheGuard } from "@/components/bfcache-guard"

function firePageShow(persisted: boolean) {
  const event = new Event("pageshow") as PageTransitionEvent
  Object.defineProperty(event, "persisted", { value: persisted })
  window.dispatchEvent(event)
}

describe("BfcacheGuard", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reloads the page when restored from the bfcache (persisted)", () => {
    const reload = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    })
    render(<BfcacheGuard />)
    firePageShow(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("does not reload on a normal (non-persisted) load", () => {
    const reload = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    })
    render(<BfcacheGuard />)
    firePageShow(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it("removes the listener on unmount", () => {
    const reload = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    })
    const { unmount } = render(<BfcacheGuard />)
    unmount()
    firePageShow(true)
    expect(reload).not.toHaveBeenCalled()
  })
})
