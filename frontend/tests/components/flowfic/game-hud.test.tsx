import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { GameHud } from "@/components/flowfic/game-hud"

import { renderWithLocale } from "@/tests/utils"

type Props = React.ComponentProps<typeof GameHud>

const baseProps: Props = {
  idleSecondsLeft: 7,
  idleSecondsTotal: 7,
  globalSecondsLeft: 60,
  globalSecondsTotal: 60,
  requiredWordsEnabled: true,
  requiredWord: null,
  useWordIn: null,
  useWordTotal: null,
  paused: false,
  ended: false,
  onPause: () => {},
  onResume: () => {},
  onQuit: () => {},
  onFinish: () => {},
}

function renderHud(props: Partial<Props> = {}) {
  return renderWithLocale(<GameHud {...baseProps} {...props} />)
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

  it("hides the idle timer bar when the idle timeout is disabled", () => {
    renderHud({ idleSecondsLeft: null })
    expect(screen.queryByRole("progressbar", { name: /idle timeout in/i })).toBeNull()
    // The session bar is unaffected.
    expect(screen.getByRole("progressbar", { name: /session ends in/i })).toBeInTheDocument()
  })

  it("offers Pause and Quit while running, and fires them", async () => {
    const onPause = vi.fn()
    const onQuit = vi.fn()
    renderHud({ onPause, onQuit })

    await userEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(onPause).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByRole("button", { name: "Quit session" }))
    expect(onQuit).toHaveBeenCalledOnce()
  })

  it("swaps Pause for Resume once paused", async () => {
    const onResume = vi.fn()
    renderHud({ paused: true, onResume })

    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Resume" }))
    expect(onResume).toHaveBeenCalledOnce()
  })

  it("hides the required-word panel when requiredWordsEnabled=false", () => {
    renderHud({ requiredWordsEnabled: false, requiredWord: "anything" })
    expect(screen.queryByText("anything")).not.toBeInTheDocument()
  })

  it("renders the active required word", () => {
    renderHud({ requiredWord: "ghost" })
    expect(screen.getByText("ghost")).toBeInTheDocument()
  })
})
