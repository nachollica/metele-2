import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { WelcomeModal } from "@/components/metele/welcome-modal"

import { renderWithLocale } from "@/tests/utils"

describe("WelcomeModal", () => {
  it("renders the dialog with all five rules when open", () => {
    renderWithLocale(<WelcomeModal open onContinue={() => {}} />)

    expect(screen.getByRole("dialog", { name: /welcome to metele/i })).toBeInTheDocument()
    // Five list items, one per rule defined in the i18n dictionary.
    expect(screen.getAllByRole("listitem")).toHaveLength(5)
  })

  it("calls onContinue(false) when the user starts without checking the box", async () => {
    const onContinue = vi.fn()
    renderWithLocale(<WelcomeModal open onContinue={onContinue} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /got it/i }))

    expect(onContinue).toHaveBeenCalledExactlyOnceWith(false)
  })

  it("calls onContinue(true) when the user checks 'don't show again'", async () => {
    const onContinue = vi.fn()
    renderWithLocale(<WelcomeModal open onContinue={onContinue} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("checkbox", { name: /don't show this again/i }))
    await user.click(screen.getByRole("button", { name: /got it/i }))

    expect(onContinue).toHaveBeenCalledExactlyOnceWith(true)
  })

  it("does not render anything when closed", () => {
    renderWithLocale(<WelcomeModal open={false} onContinue={() => {}} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
