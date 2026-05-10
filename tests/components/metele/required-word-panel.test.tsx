import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RequiredWordPanel } from "@/components/metele/required-word-panel"

import { renderWithLocale } from "@/tests/utils"

describe("RequiredWordPanel", () => {
  it("renders the placeholder when no word is active", () => {
    renderWithLocale(
      <RequiredWordPanel word={null} useWordIn={null} useWordTotal={null} />,
    )
    expect(screen.getByText(/keep writing/i)).toBeInTheDocument()
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
