import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SettingsModal } from "@/components/metele/settings-modal"
import { AuthProvider } from "@/lib/auth"
import { DEFAULT_SETTINGS, PRESETS } from "@/lib/metele/types"

import { renderWithLocale } from "@/tests/utils"

function renderModal(props: Partial<React.ComponentProps<typeof SettingsModal>> = {}) {
  return renderWithLocale(
    <AuthProvider>
      <SettingsModal open onStart={() => {}} {...props} />
    </AuthProvider>,
  )
}

describe("SettingsModal", () => {
  it("renders one button per preset and marks the matching one active", () => {
    renderModal()
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

  it("starts the game with the current settings when 'Start writing' is clicked", async () => {
    const onStart = vi.fn()
    renderModal({ onStart })
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /start writing/i }))
    expect(onStart).toHaveBeenCalledExactlyOnceWith(DEFAULT_SETTINGS)
  })

  it("applies a preset's preset-covered keys without touching personal settings", async () => {
    const onStart = vi.fn()
    // Personal setting (bellEnabled=false) must survive the preset application.
    const initial = { ...DEFAULT_SETTINGS, bellEnabled: false }
    renderModal({ initial, onStart })

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /chaos/i }))
    await user.click(screen.getByRole("button", { name: /start writing/i }))

    const chaos = PRESETS.find((p) => p.id === "chaos")!
    expect(onStart).toHaveBeenCalledOnce()
    const out = onStart.mock.calls[0]?.[0]
    expect(out).toMatchObject(chaos.settings)
    expect(out.bellEnabled).toBe(false)
  })
})
