import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SaveFailureAlert } from "@/components/flowfic/save-failure-alert"

import { renderWithLocale } from "@/tests/utils"

describe("SaveFailureAlert", () => {
  it("announces itself and offers both ways out", () => {
    renderWithLocale(
      <SaveFailureAlert retrying={false} onRetry={vi.fn()} onDismiss={vi.fn()} />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't save your last story/i)
    expect(screen.getByRole("button", { name: /retry/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeEnabled()
  })

  it("locks both controls while a retry is in flight", () => {
    renderWithLocale(<SaveFailureAlert retrying onRetry={vi.fn()} onDismiss={vi.fn()} />)

    expect(screen.getByRole("button", { name: /retrying/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeDisabled()
  })

  it("retries and dismisses through its callbacks", async () => {
    const onRetry = vi.fn()
    const onDismiss = vi.fn()
    renderWithLocale(
      <SaveFailureAlert retrying={false} onRetry={onRetry} onDismiss={onDismiss} />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /retry/i }))
    await user.click(screen.getByRole("button", { name: /dismiss/i }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
