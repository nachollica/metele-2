import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ResultsModal } from "@/components/flowfic/results-modal"
import type { GameResult } from "@/lib/flowfic/types"

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
  it("renders nothing when closed", () => {
    renderWithLocale(<ResultsModal open={false} result={baseResult} onClose={() => {}} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("displays computed stats and the per-reason description", () => {
    renderWithLocale(<ResultsModal open result={baseResult} onClose={() => {}} />)
    expect(screen.getByText("01:05")).toBeInTheDocument()
    expect(screen.getByText("240")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText(/stopped typing/i)).toBeInTheDocument()
  })

  it("does not render the story text or an editable textarea", () => {
    renderWithLocale(<ResultsModal open result={baseResult} onClose={() => {}} />)
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByText(baseResult.text)).not.toBeInTheDocument()
  })

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn()
    renderWithLocale(<ResultsModal open result={baseResult} onClose={onClose} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /continue editing/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
