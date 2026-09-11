import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { RecoverStoryModal } from "@/components/flowfic/recover-story-modal"
import type { PendingStory } from "@/lib/flowfic/pending-story"
import { DEFAULT_SETTINGS } from "@/lib/flowfic/types"

import { renderWithLocale } from "@/tests/utils"

const TEXT =
  "The lighthouse had been dark for three winters when Marta climbed the hundred and twenty steps for the last time."

function pending(overrides: Partial<PendingStory["payload"]> = {}): PendingStory {
  return {
    savedAt: Date.now(),
    intent: false,
    payload: {
      title: null,
      text: TEXT,
      lang: "en",
      settings: DEFAULT_SETTINGS,
      stats: {
        reason: "global",
        durationMs: 600_000,
        characters: TEXT.length,
        words: 21,
        requiredWordsUsed: 3,
      },
      ...overrides,
    },
  }
}

describe("RecoverStoryModal", () => {
  it("stays closed when there is no draft to offer", () => {
    const { container } = renderWithLocale(
      <RecoverStoryModal
        pending={null}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("names what it found rather than assuming the story is remembered", () => {
    renderWithLocale(
      <RecoverStoryModal
        pending={pending({ title: "The dark lighthouse" })}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByRole("heading", { name: /unsaved story/i })).toBeInTheDocument()
    // Title, length and date together: enough to recognise it without opening it.
    expect(screen.getByText(/The dark lighthouse — 21 words, Today/)).toBeInTheDocument()
    expect(screen.getByText(/The lighthouse had been dark/)).toBeInTheDocument()
  })

  it("falls back to a derived title when the story was never named", () => {
    renderWithLocale(
      <RecoverStoryModal
        pending={pending()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/The lighthouse had been dark.*— 21 words/)).toBeInTheDocument()
  })

  it("saves when accepted", async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    renderWithLocale(
      <RecoverStoryModal
        pending={pending()}
        onSave={onSave}
        onDiscard={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /save it to my stories/i }))

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("stays up and explains itself when the save fails, so it can be retried", async () => {
    const onSave = vi.fn().mockResolvedValue(false)
    renderWithLocale(
      <RecoverStoryModal
        pending={pending()}
        onSave={onSave}
        onDiscard={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /save it to my stories/i }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/couldn't save it/i))
    expect(screen.getByRole("button", { name: /save it to my stories/i })).toBeEnabled()
  })

  it("confirms before discarding, and backs out without dropping anything", async () => {
    const onDiscard = vi.fn()
    renderWithLocale(
      <RecoverStoryModal
        pending={pending()}
        onSave={vi.fn()}
        onDiscard={onDiscard}
        onOpenChange={vi.fn()}
      />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /discard it/i }))
    expect(screen.getByRole("heading", { name: /lose this story\?/i })).toBeInTheDocument()
    expect(onDiscard).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /keep my story/i }))
    expect(screen.getByRole("button", { name: /save it to my stories/i })).toBeInTheDocument()
    expect(onDiscard).not.toHaveBeenCalled()
  })

  it("discards only from the confirm button", async () => {
    const onDiscard = vi.fn()
    renderWithLocale(
      <RecoverStoryModal
        pending={pending()}
        onSave={vi.fn()}
        onDiscard={onDiscard}
        onOpenChange={vi.fn()}
      />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /discard it/i }))
    await user.click(screen.getByRole("button", { name: /discard the story/i }))

    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it("renders in Spanish under the es locale", () => {
    renderWithLocale(
      <RecoverStoryModal
        pending={pending({ title: "El faro" })}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onOpenChange={vi.fn()}
      />,
      { locale: "es" },
    )

    expect(screen.getByRole("heading", { name: /historia sin guardar/i })).toBeInTheDocument()
    expect(screen.getByText(/El faro — 21 palabras, Hoy/)).toBeInTheDocument()
  })
})
