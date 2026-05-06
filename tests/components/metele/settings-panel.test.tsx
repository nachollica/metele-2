import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { SettingsPanel } from "@/components/metele/settings-panel"
import type { AuthContextValue, AuthUser } from "@/lib/auth"
import { DEFAULT_SETTINGS, PRESETS, type GameSettings } from "@/lib/metele/types"

import { renderWithLocale } from "@/tests/utils"

const baseUser: AuthUser = {
  id: "google-oauth2|abc",
  email: "x@example.com",
  name: "Tester",
  avatarUrl: null,
  customPresets: [],
}

const authState: { current: AuthContextValue } = {
  current: makeAuth(),
}

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "authenticated",
    user: baseUser,
    loginWithProvider: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue("tok"),
    applyLocalUser: vi.fn(),
    loginAsDevUser: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    useAuth: () => authState.current,
  }
})

function Harness({
  initial = DEFAULT_SETTINGS,
  onChange,
}: {
  initial?: GameSettings
  onChange?: (s: GameSettings) => void
}) {
  const [settings, setSettings] = useState<GameSettings>(initial)
  return (
    <SettingsPanel
      settings={settings}
      onChange={(s) => {
        setSettings(s)
        onChange?.(s)
      }}
    />
  )
}

describe("SettingsPanel", () => {
  it("renders one button per preset and marks the matching one active", () => {
    authState.current = makeAuth()
    renderWithLocale(<Harness />)
    for (const preset of PRESETS) {
      const btn = screen.getByRole("button", {
        name: new RegExp(preset.id, "i"),
      })
      expect(btn).toBeInTheDocument()
    }
    // DEFAULT_SETTINGS matches "classic" — that button reports aria-pressed.
    const classic = screen.getByRole("button", { name: /classic/i })
    expect(classic).toHaveAttribute("aria-pressed", "true")
  })

  it("emits a preset-merged settings object without touching personal settings", async () => {
    authState.current = makeAuth()
    const onChange = vi.fn()
    // Personal setting (bellEnabled=false) must survive the preset application.
    const initial = { ...DEFAULT_SETTINGS, bellEnabled: false }
    renderWithLocale(<Harness initial={initial} onChange={onChange} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /marathon/i }))

    const marathon = PRESETS.find((p) => p.id === "marathon")!
    expect(onChange).toHaveBeenCalledOnce()
    const out = onChange.mock.calls[0]?.[0]
    expect(out).toMatchObject(marathon.settings)
    expect(out.bellEnabled).toBe(false)
  })

  it("hides the required-word sub-settings when the interval toggle is off", () => {
    authState.current = makeAuth()
    renderWithLocale(
      <Harness initial={{ ...DEFAULT_SETTINGS, requiredWordIntervalEnabled: false }} />,
    )
    expect(
      screen.queryByLabelText(/enforce required-word deadline/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/use custom word categories/i),
    ).not.toBeInTheDocument()
  })
})
