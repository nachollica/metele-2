import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { GameHud } from "@/components/metele/game-hud"
import { AuthProvider } from "@/lib/auth"

import { renderWithLocale } from "@/tests/utils"

type Props = React.ComponentProps<typeof GameHud>

const baseProps: Props = {
  idleSecondsLeft: 7,
  idleSecondsTotal: 7,
  globalSecondsLeft: 60,
  globalSecondsTotal: 60,
  characters: 0,
  paused: false,
  onGiveUp: () => {},
  onStartAgain: () => {},
  requiredWordsEnabled: true,
  requiredWord: null,
  useWordIn: null,
  useWordTotal: null,
}

function renderHud(props: Partial<Props> = {}) {
  return renderWithLocale(
    <AuthProvider>
      <GameHud {...baseProps} {...props} />
    </AuthProvider>,
  )
}

describe("GameHud", () => {
  it("renders the idle and session timer bars with correct aria-valuenow", () => {
    renderHud({ idleSecondsLeft: 5, globalSecondsLeft: 45 })
    const bars = screen.getAllByRole("progressbar")
    expect(bars.length).toBeGreaterThanOrEqual(2)
    const valueNows = bars.map((b) => b.getAttribute("aria-valuenow"))
    expect(valueNows).toContain("5")
    expect(valueNows).toContain("45")
  })

  it("hides the global timer bar when globalSecondsLeft is null", () => {
    renderHud({ globalSecondsLeft: null })
    expect(screen.queryByRole("progressbar", { name: /session ends in/i })).toBeNull()
  })

  it("hides the required-word panel when requiredWordsEnabled=false", () => {
    renderHud({ requiredWordsEnabled: false, requiredWord: "anything" })
    expect(screen.queryByText("anything")).not.toBeInTheDocument()
  })

  it("calls onGiveUp when the give-up button is clicked", async () => {
    const onGiveUp = vi.fn()
    renderHud({ onGiveUp })
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /give up/i }))
    expect(onGiveUp).toHaveBeenCalledOnce()
  })

  it("swaps the give-up button for a start-again button when paused", async () => {
    const onStartAgain = vi.fn()
    renderHud({ paused: true, onStartAgain })
    expect(screen.queryByRole("button", { name: /give up/i })).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /start again/i }))
    expect(onStartAgain).toHaveBeenCalledOnce()
  })

  it("keeps the required-word panel and the active word visible when paused", () => {
    renderHud({ paused: true, requiredWord: "ghost" })
    expect(screen.getByText("ghost")).toBeInTheDocument()
  })
})
