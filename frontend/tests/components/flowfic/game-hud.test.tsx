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
  it("renders both timer bars as a fraction of the time they started with", () => {
    // A percentage, since it shares the app's one progress bar; the clock the
    // player actually needs is on `aria-valuetext` (asserted further down).
    renderHud({
      idleSecondsLeft: 5,
      idleSecondsTotal: 10,
      globalSecondsLeft: 45,
      globalSecondsTotal: 60,
    })

    expect(screen.getByRole("progressbar", { name: /idle timeout in/i })).toHaveAttribute(
      "aria-valuenow",
      "50",
    )
    expect(screen.getByRole("progressbar", { name: /session ends in/i })).toHaveAttribute(
      "aria-valuenow",
      "75",
    )
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

  it("spells the timer bars out as a clock, not a percentage", () => {
    renderHud({ idleSecondsLeft: 5, globalSecondsLeft: 90 })

    expect(screen.getByRole("progressbar", { name: /idle timeout in/i })).toHaveAttribute(
      "aria-valuetext",
      "5s",
    )
    expect(screen.getByRole("progressbar", { name: /session ends in/i })).toHaveAttribute(
      "aria-valuetext",
      "1m 30s",
    )
  })

  it("announces the pause and the resume, but says nothing on mount", () => {
    // A sprint always starts running, so the initial state is not news.
    const { rerender } = renderHud()
    expect(screen.getByRole("status")).toHaveTextContent("")

    rerender(<GameHud {...baseProps} paused />)
    expect(screen.getByRole("status")).toHaveTextContent(
      "Session paused. The timers are frozen.",
    )

    rerender(<GameHud {...baseProps} paused={false} />)
    expect(screen.getByRole("status")).toHaveTextContent("Session resumed.")
  })

  it("announces the pause in the active locale", () => {
    const { rerender } = renderWithLocale(<GameHud {...baseProps} />, { locale: "es" })

    rerender(<GameHud {...baseProps} paused />)
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sesión en pausa. Los temporizadores están congelados.",
    )
  })
})
