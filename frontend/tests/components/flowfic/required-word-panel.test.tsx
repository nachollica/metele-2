import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RequiredWordPanel } from "@/components/flowfic/required-word-panel"

import { renderWithLocale } from "@/tests/utils"

describe("RequiredWordPanel", () => {
  it("waits with a mark rather than an instruction when no word is active", () => {
    renderWithLocale(
      <RequiredWordPanel word={null} useWordIn={null} useWordTotal={null} />,
    )
    // Decorative: the panel's own live region is what announces a word
    // arriving, so the waiting state must not add a second thing to read out.
    const marker = screen.getByText("•••")
    expect(marker).toBeInTheDocument()
    expect(marker).toHaveAttribute("aria-hidden", "true")
  })

  it("renders the word and the remaining time when active", () => {
    renderWithLocale(
      <RequiredWordPanel word="lighthouse" useWordIn={12} useWordTotal={25} />,
    )
    expect(screen.getByText("lighthouse")).toBeInTheDocument()
    expect(screen.getByTestId("progress-ring")).toBeInTheDocument()
  })

  it("does not show a deadline when useWordIn is null", () => {
    renderWithLocale(
      <RequiredWordPanel word="ember" useWordIn={null} useWordTotal={null} />,
    )
    expect(screen.queryByTestId("progress-ring")).not.toBeInTheDocument()
    expect(screen.getByText("ember")).toBeInTheDocument()
  })
})
