import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { WelcomeModal } from "@/components/flowfic/welcome-modal"

import { renderWithLocale } from "@/tests/utils"

describe("WelcomeModal", () => {
  it("opens on the intro card with the welcome heading", () => {
    renderWithLocale(<WelcomeModal open onContinue={() => {}} />)

    expect(screen.getByRole("dialog", { name: /welcome to flowfic/i })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: /welcome to flowfic/i })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: /set up your sprint/i }),
    ).not.toBeInTheDocument()
  })

  it("renders five dot navigators", () => {
    renderWithLocale(<WelcomeModal open onContinue={() => {}} />)
    expect(screen.getAllByRole("button", { name: /go to step \d+/i })).toHaveLength(5)
  })

  it("shows the skip-tutorial button on the first step instead of a back arrow", () => {
    renderWithLocale(<WelcomeModal open onContinue={() => {}} />)

    expect(screen.getByRole("button", { name: /skip tutorial/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^back$/i })).not.toBeInTheDocument()
  })

  it("calls onContinue(false) when skipping the tutorial without checking the box", async () => {
    const onContinue = vi.fn()
    renderWithLocale(<WelcomeModal open onContinue={onContinue} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /skip tutorial/i }))
    expect(onContinue).toHaveBeenCalledExactlyOnceWith(false)
  })

  it("calls onContinue(true) when skipping after checking 'don't show again'", async () => {
    const onContinue = vi.fn()
    renderWithLocale(<WelcomeModal open onContinue={onContinue} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("checkbox", { name: /don't show this again/i }))
    await user.click(screen.getByRole("button", { name: /skip tutorial/i }))
    expect(onContinue).toHaveBeenCalledExactlyOnceWith(true)
  })

  it("advances and goes back through steps", async () => {
    renderWithLocale(<WelcomeModal open onContinue={() => {}} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /next/i }))
    expect(screen.getByRole("heading", { name: /set up your sprint/i })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^back$/i }))
    expect(screen.getByRole("heading", { level: 3, name: /welcome to flowfic/i })).toBeInTheDocument()
  })

  it("jumps to a step when its dot is clicked", async () => {
    renderWithLocale(<WelcomeModal open onContinue={() => {}} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /go to step 4/i }))
    expect(screen.getByRole("heading", { name: /required words/i })).toBeInTheDocument()
  })

  it("shows 'Got it' on the last step and calls onContinue when clicked", async () => {
    const onContinue = vi.fn()
    renderWithLocale(<WelcomeModal open onContinue={onContinue} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /go to step 5/i }))
    expect(screen.getByRole("heading", { name: /level up as you write/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /got it/i }))
    expect(onContinue).toHaveBeenCalledExactlyOnceWith(false)
  })

  it("calls onContinue(true) when checking 'don't show again' before finishing", async () => {
    const onContinue = vi.fn()
    renderWithLocale(<WelcomeModal open onContinue={onContinue} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /go to step 5/i }))
    await user.click(screen.getByRole("checkbox", { name: /don't show this again/i }))
    await user.click(screen.getByRole("button", { name: /got it/i }))

    expect(onContinue).toHaveBeenCalledExactlyOnceWith(true)
  })

  it("does not render anything when closed", () => {
    renderWithLocale(<WelcomeModal open={false} onContinue={() => {}} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
