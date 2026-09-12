import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { StoryCard } from "@/components/flowfic/story-card"
import type { Story } from "@/lib/flowfic/stories-api"
import { renderWithLocale } from "../../utils"

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 3,
    title: null,
    text: "The lighthouse keeper counted the waves at dusk.",
    lang: "en",
    createdAt: new Date().toISOString(),
    userId: "u",
    privacy: "private",
    settings: {},
    stats: { words: 42 },
    ...overrides,
  }
}

describe("StoryCard", () => {
  it("derives a title from the text and shows a words + date meta line", () => {
    renderWithLocale(<StoryCard story={makeStory()} />)
    expect(
      screen.getByText("The lighthouse keeper counted the waves"),
    ).toBeInTheDocument()
    expect(screen.getByText(/42 words · Today/)).toBeInTheDocument()
  })

  it("prefers an explicit title when present", () => {
    renderWithLocale(<StoryCard story={makeStory({ title: "My Tale" })} />)
    expect(screen.getByText("My Tale")).toBeInTheDocument()
  })

  it("calls onSelect when the row is clicked", () => {
    const onSelect = vi.fn()
    renderWithLocale(<StoryCard story={makeStory()} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole("button", { name: /lighthouse keeper/i }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it("hides the options menu when no delete/rename handler is given", () => {
    renderWithLocale(<StoryCard story={makeStory()} />)
    expect(
      screen.queryByRole("button", { name: "Story options" }),
    ).not.toBeInTheDocument()
  })

  it("renames inline through the options menu", async () => {
    const onUpdateStory = vi.fn().mockResolvedValue(true)
    const user = userEvent.setup()
    renderWithLocale(<StoryCard story={makeStory()} onUpdateStory={onUpdateStory} />)

    await user.click(screen.getByRole("button", { name: "Story options" }))
    await user.click(screen.getByRole("menuitem", { name: /rename/i }))

    const input = screen.getByRole("textbox", { name: /story title/i })
    await user.type(input, "Coastal Nights")
    await user.click(screen.getByRole("button", { name: /save title/i }))

    expect(onUpdateStory).toHaveBeenCalledWith(3, { title: "Coastal Nights" })
  })

  describe("privacy control", () => {
    it("hides the privacy control when no update handler is given", () => {
      renderWithLocale(<StoryCard story={makeStory()} />)
      expect(
        screen.queryByRole("button", { name: /visibility/i }),
      ).not.toBeInTheDocument()
    })

    it("shows the current privacy level's icon button", () => {
      renderWithLocale(
        <StoryCard story={makeStory({ privacy: "connections" })} onUpdateStory={vi.fn()} />,
      )
      expect(
        screen.getByRole("button", { name: "Visibility: Connections" }),
      ).toBeInTheDocument()
    })

    it("changes privacy through the menu", async () => {
      const onUpdateStory = vi.fn().mockResolvedValue(true)
      const user = userEvent.setup()
      renderWithLocale(<StoryCard story={makeStory()} onUpdateStory={onUpdateStory} />)

      await user.click(screen.getByRole("button", { name: "Visibility: Private" }))
      await user.click(screen.getByRole("menuitemradio", { name: /public/i }))

      expect(onUpdateStory).toHaveBeenCalledWith(3, { privacy: "public" })
    })

    it("shows an inline error and keeps the menu open when the update fails", async () => {
      const onUpdateStory = vi.fn().mockResolvedValue(false)
      const user = userEvent.setup()
      renderWithLocale(<StoryCard story={makeStory()} onUpdateStory={onUpdateStory} />)

      await user.click(screen.getByRole("button", { name: "Visibility: Private" }))
      await user.click(screen.getByRole("menuitemradio", { name: /public/i }))

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't update the story's visibility.",
      )
      // The menu is still open — the radio group is still in the document.
      expect(screen.getByRole("menuitemradio", { name: /public/i })).toBeInTheDocument()
    })
  })
})
