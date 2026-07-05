import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

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

  it("hides the required-word panel when requiredWordsEnabled=false", () => {
    renderHud({ requiredWordsEnabled: false, requiredWord: "anything" })
    expect(screen.queryByText("anything")).not.toBeInTheDocument()
  })

  it("renders the active required word", () => {
    renderHud({ requiredWord: "ghost" })
    expect(screen.getByText("ghost")).toBeInTheDocument()
  })
})
