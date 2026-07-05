import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BackendStatusProvider, useBackendStatus } from "@/lib/backend"

function Probe() {
  const { status, devUserEnabled } = useBackendStatus()
  return (
    <div data-testid="probe">
      {status}:{String(devUserEnabled)}
    </div>
  )
}

const OK_PING = {
  status: "ok",
  version: "1.0.0",
  environment: "testing",
  devUserEnabled: true,
  utcStartedAt: "2026-01-01T00:00:00+00:00",
}

describe("BackendStatusProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reports reachable + devUserEnabled after the first /ping succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => OK_PING }),
    )
    render(
      <BackendStatusProvider>
        <Probe />
      </BackendStatusProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("reachable:true"),
    )
  })

  it("reports unreachable when /ping fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
    render(
      <BackendStatusProvider>
        <Probe />
      </BackendStatusProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("unreachable:false"),
    )
  })

  it("flips to unreachable on the browser 'offline' event without a request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => OK_PING }),
    )
    render(
      <BackendStatusProvider>
        <Probe />
      </BackendStatusProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("reachable:true"),
    )

    act(() => {
      window.dispatchEvent(new Event("offline"))
    })
    expect(screen.getByTestId("probe")).toHaveTextContent("unreachable:false")
  })
})
