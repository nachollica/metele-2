import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { SessionLauncher } from "@/components/flowfic/session-launcher"
import { type GridMode } from "@/components/flowfic/preset-grid"
import type { AuthContextValue, AuthUser } from "@/lib/auth"
import { DEFAULT_SETTINGS, PRESETS, type GameSettings } from "@/lib/flowfic/types"

import { renderWithLocale } from "@/tests/utils"

const baseUser: AuthUser = {
  id: "google-oauth2|abc",
  email: "x@example.com",
  name: "Tester",
  avatarUrl: null,
  customPresets: [],
}

const authState: { current: AuthContextValue } = { current: makeAuth() }

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "authenticated",
    user: baseUser,
    loginWithProvider: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue("tok"),
    applyLocalUser: vi.fn(),
    loginAsDevUser: vi.fn().mockResolvedValue({ ok: false, reason: "error" as const }),
    ...overrides,
  }
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return { ...actual, useAuth: () => authState.current }
})

function Harness({
  initial = DEFAULT_SETTINGS,
  onStart = vi.fn(),
  onToggleSettings = vi.fn(),
  settingsOpen = false,
  onChange,
}: {
  initial?: GameSettings
  onStart?: () => void
  onToggleSettings?: () => void
  settingsOpen?: boolean
  onChange?: (s: GameSettings) => void
}) {
  const [settings, setSettings] = useState<GameSettings>(initial)
  const [gridMode, setGridMode] = useState<GridMode>("system")
  return (
    <SessionLauncher
      settings={settings}
      onChange={(s) => {
        setSettings(s)
        onChange?.(s)
      }}
      onStart={onStart}
      settingsOpen={settingsOpen}
      onToggleSettings={onToggleSettings}
      gridMode={gridMode}
      onToggleGridMode={() => setGridMode((m) => (m === "system" ? "custom" : "system"))}
    />
  )
}

describe("SessionLauncher", () => {
  it("shows the default 10-minute session on the dial", () => {
    authState.current = makeAuth()
    renderWithLocale(<Harness />)
    expect(screen.getByText("10:00")).toBeInTheDocument()
  })

  it("heads each half of the launcher", async () => {
    authState.current = makeAuth()
    renderWithLocale(<Harness />)
    expect(screen.getByRole("heading", { name: "Select a duration" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Game modes" })).toBeInTheDocument()

    // The heading names the grid, not the face it shows: flipping to the
    // custom modes is still picking a game mode.
    await userEvent.click(screen.getByRole("button", { name: "Custom modes" }))
    expect(screen.getByRole("heading", { name: "Game modes" })).toBeInTheDocument()
  })

  it("re-dials the session length without un-highlighting the selected mode", async () => {
    authState.current = makeAuth()
    const onChange = vi.fn()
    renderWithLocale(<Harness onChange={onChange} />)

    // DEFAULT_SETTINGS matches "classic", which reports aria-pressed.
    expect(screen.getByRole("button", { name: /classic/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    )

    await userEvent.click(screen.getByRole("combobox", { name: /session length/i }))
    await userEvent.click(screen.getByRole("option", { name: "25 minutes" }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0]?.[0].globalTimerSeconds).toBe(25 * 60)
    expect(screen.getByText("25:00")).toBeInTheDocument()
    // Session length is excluded from mode matching, so Classic stays selected.
    expect(screen.getByRole("button", { name: /classic/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  it("renders exactly the three system modes plus the challenge card", () => {
    authState.current = makeAuth()
    renderWithLocale(<Harness />)
    expect(PRESETS.map((p) => p.id)).toEqual(["classic", "speed", "creative"])
    for (const name of [/classic/i, /fast/i, /super creative/i]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }
    expect(screen.getByRole("button", { name: /challenge of the day/i })).toBeInTheDocument()
  })

  it("applies a mode's settings while preserving personal ones", async () => {
    authState.current = makeAuth()
    const onChange = vi.fn()
    // soundEnabled is a personal setting and must survive the mode change.
    renderWithLocale(
      <Harness initial={{ ...DEFAULT_SETTINGS, soundEnabled: false }} onChange={onChange} />,
    )

    await userEvent.click(screen.getByRole("button", { name: /fast/i }))

    const speed = PRESETS.find((p) => p.id === "speed")!
    const out = onChange.mock.calls[0]?.[0]
    expect(out).toMatchObject(speed.settings)
    expect(out.soundEnabled).toBe(false)
  })

  it("starts the sprint from the Start button", async () => {
    authState.current = makeAuth()
    const onStart = vi.fn()
    renderWithLocale(<Harness onStart={onStart} />)
    await userEvent.click(screen.getByRole("button", { name: /start writing/i }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it("starts the sprint directly from the challenge card, keeping the dialled length", async () => {
    authState.current = makeAuth()
    const onStart = vi.fn()
    const onChange = vi.fn()
    renderWithLocale(
      <Harness
        initial={{ ...DEFAULT_SETTINGS, globalTimerSeconds: 25 * 60 }}
        onStart={onStart}
        onChange={onChange}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: /challenge of the day/i }))

    expect(onStart).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0]?.[0].globalTimerSeconds).toBe(25 * 60)
  })

  it("flips the grid between default and custom modes", async () => {
    authState.current = makeAuth()
    renderWithLocale(<Harness />)

    await userEvent.click(screen.getByRole("button", { name: "Custom modes" }))
    // The system modes and the challenge are gone; the create slot is offered.
    expect(screen.queryByRole("button", { name: /classic/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /challenge of the day/i })).toBeNull()
    expect(screen.getByRole("button", { name: /save current settings/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Default modes" }))
    expect(screen.getByRole("button", { name: /classic/i })).toBeInTheDocument()
  })

  it("prompts anonymous users to sign in for custom modes", async () => {
    authState.current = makeAuth({ status: "anonymous", user: null })
    renderWithLocale(<Harness />)
    await userEvent.click(screen.getByRole("button", { name: "Custom modes" }))
    expect(screen.getByText(/sign in to save custom modes/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /save current settings/i })).toBeNull()
  })

  it("reports the settings-panel toggle state for assistive tech", async () => {
    authState.current = makeAuth()
    const onToggleSettings = vi.fn()
    renderWithLocale(<Harness onToggleSettings={onToggleSettings} />)

    const moreOptions = screen.getByRole("button", { name: "More options" })
    expect(moreOptions).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(moreOptions)
    expect(onToggleSettings).toHaveBeenCalledOnce()
  })
})
