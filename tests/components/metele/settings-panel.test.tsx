import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { SettingsPanel } from "@/components/metele/settings-panel"
import { DEFAULT_SETTINGS, PRESETS, type GameSettings } from "@/lib/metele/types"

import { renderWithLocale } from "@/tests/utils"

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
    const onChange = vi.fn()
    // Personal setting (bellEnabled=false) must survive the preset application.
    const initial = { ...DEFAULT_SETTINGS, bellEnabled: false }
    renderWithLocale(<Harness initial={initial} onChange={onChange} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /chaos/i }))

    const chaos = PRESETS.find((p) => p.id === "chaos")!
    expect(onChange).toHaveBeenCalledOnce()
    const out = onChange.mock.calls[0]?.[0]
    expect(out).toMatchObject(chaos.settings)
    expect(out.bellEnabled).toBe(false)
  })

  it("hides the required-word sub-settings when the interval toggle is off", () => {
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
