import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { SettingsPanel } from "@/components/flowfic/settings-panel"
import { DEFAULT_SETTINGS, type GameSettings } from "@/lib/flowfic/types"

import { renderWithLocale } from "@/tests/utils"

// The mode picker and the session-length dial live in the launcher now (see
// session-launcher.test.tsx); this panel is only the advanced rows.

function Harness({ initial = DEFAULT_SETTINGS }: { initial?: GameSettings }) {
  const [settings, setSettings] = useState<GameSettings>(initial)
  return <SettingsPanel settings={settings} onChange={setSettings} />
}

describe("SettingsPanel", () => {
  it("does not render the mode picker or the session-length control", () => {
    renderWithLocale(<Harness />)
    expect(screen.queryByRole("button", { name: /classic/i })).toBeNull()
    expect(screen.queryByRole("slider", { name: /session length/i })).toBeNull()
  })

  it("toggles the idle timeout and dims its slider when off", async () => {
    renderWithLocale(<Harness />)
    const slider = screen.getByRole("slider", { name: /idle timeout/i })
    expect(slider).not.toHaveAttribute("data-disabled")

    await userEvent.click(screen.getByLabelText(/enable the idle timeout/i))
    expect(screen.getByRole("slider", { name: /idle timeout/i })).toHaveAttribute(
      "data-disabled",
    )
  })

  it("keeps the required-word sub-settings visible but disabled when the master toggle is off", () => {
    renderWithLocale(
      <Harness initial={{ ...DEFAULT_SETTINGS, requiredWordIntervalEnabled: false }} />,
    )
    // The rows stay mounted (the panel keeps a stable height) …
    expect(screen.getByLabelText(/enforce required-word deadline/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/enable word sound/i)).toBeInTheDocument()
    // … but every control in them is disabled, as is the word source.
    expect(screen.getByLabelText(/enforce required-word deadline/i)).toBeDisabled()
    expect(screen.getByLabelText(/enable word sound/i)).toBeDisabled()
    expect(screen.getByLabelText(/word source/i)).toBeDisabled()
    expect(screen.getByLabelText(/sound type/i)).toBeDisabled()
    expect(
      screen.getByRole("slider", { name: /new required word every/i }),
    ).toHaveAttribute("data-disabled")
  })

  it("shows the sound mode dropdown enabled when required words and sound are both on", () => {
    renderWithLocale(
      <Harness
        initial={{
          ...DEFAULT_SETTINGS,
          requiredWordIntervalEnabled: true,
          soundEnabled: true,
        }}
      />,
    )
    expect(screen.getByLabelText(/sound type/i)).toBeEnabled()
  })

  it("disables just the sound mode dropdown when sound alone is off", () => {
    renderWithLocale(
      <Harness
        initial={{
          ...DEFAULT_SETTINGS,
          requiredWordIntervalEnabled: true,
          soundEnabled: false,
        }}
      />,
    )
    expect(screen.getByLabelText(/sound type/i)).toBeDisabled()
    expect(screen.getByLabelText(/enable word sound/i)).toBeEnabled()
  })
})
