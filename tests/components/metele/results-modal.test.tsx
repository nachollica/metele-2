import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ResultsModal } from "@/components/metele/results-modal"
import type { GameResult } from "@/lib/metele/types"

import { renderWithLocale } from "@/tests/utils"

const baseResult: GameResult = {
  reason: "idle",
  durationMs: 65 * 1000, // 01:05
  characters: 240,
  words: 42,
  requiredWordsUsed: 3,
  text: "Once upon a time…",
}

describe("ResultsModal", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders nothing when closed", () => {
    renderWithLocale(
      <ResultsModal open={false} result={baseResult} onPlayAgain={() => {}} />,
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("displays computed stats and the per-reason description", () => {
    renderWithLocale(
      <ResultsModal open result={baseResult} onPlayAgain={() => {}} />,
    )
    expect(screen.getByText("01:05")).toBeInTheDocument()
    expect(screen.getByText("240")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText(/stopped typing/i)).toBeInTheDocument()
  })

  it("seeds the editable textarea with the captured story and lets the user edit it", async () => {
    renderWithLocale(
      <ResultsModal open result={baseResult} onPlayAgain={() => {}} />,
    )
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement
    expect(textarea.value).toBe(baseResult.text)
    const user = userEvent.setup()
    await user.type(textarea, " The end.")
    expect(textarea.value).toBe(`${baseResult.text} The end.`)
  })

  it("copies the captured story to the clipboard and shows the 'Copied' feedback", async () => {
    // user-event v14 installs its own navigator.clipboard stub. We read back
    // from that stub to verify the component called clipboard.writeText with
    // the right payload.
    const user = userEvent.setup()
    renderWithLocale(
      <ResultsModal open result={baseResult} onPlayAgain={() => {}} />,
    )

    await user.click(screen.getByRole("button", { name: /copy story/i }))

    expect(await screen.findByText(/copied/i)).toBeInTheDocument()
    const copied = await navigator.clipboard.readText()
    expect(copied).toBe(baseResult.text)
  })

  it("calls onPlayAgain when the Play again button is clicked", async () => {
    const onPlayAgain = vi.fn()
    renderWithLocale(
      <ResultsModal open result={baseResult} onPlayAgain={onPlayAgain} />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /play again/i }))
    expect(onPlayAgain).toHaveBeenCalledOnce()
  })
})
