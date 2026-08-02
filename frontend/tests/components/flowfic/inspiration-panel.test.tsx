import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InspirationImage, QuoteOfDay } from "@/components/flowfic/inspiration-panel"
import { ShowAllButton } from "@/components/flowfic/dashboard-widgets"
import * as quotesModule from "@/lib/flowfic/quotes"
import type { Quote } from "@/lib/flowfic/quotes"
import * as inspirationModule from "@/lib/flowfic/inspiration"
import type { InspirationImageData, InspirationState } from "@/lib/flowfic/inspiration"
import { renderWithLocale } from "../../utils"

const IMAGE: InspirationImageData = {
  title: "And The Ship Sails On",
  page: "https://film-grab.com/2014/12/12/and-the-ship-sails-on/",
  image: "https://film-grab.com/wp-content/uploads/And-The-Ship-01.jpg",
}

describe("InspirationImage", () => {
  afterEach(() => vi.restoreAllMocks())

  function mockPick(state: InspirationState, refresh = vi.fn()): ReturnType<typeof vi.fn> {
    vi.spyOn(inspirationModule, "useInspiration").mockReturnValue({ state, refresh })
    return refresh
  }

  it("shows the card title, the centered film title, the image, and the credit link", () => {
    mockPick({ status: "ready", image: IMAGE })
    const { container } = renderWithLocale(<InspirationImage />)
    expect(screen.getByText("Inspiration")).toBeInTheDocument()
    expect(screen.getByText("And The Ship Sails On")).toBeInTheDocument()
    expect(container.querySelector("img")).toHaveAttribute("src", IMAGE.image)

    const link = screen.getByRole("link", { name: /film-grab\.com/i })
    expect(link).toHaveAttribute("href", IMAGE.page)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("re-rolls the shared pick when the refresh control is clicked", async () => {
    const refresh = mockPick({ status: "ready", image: IMAGE })
    renderWithLocale(<InspirationImage />)
    await userEvent.click(screen.getByRole("button", { name: "Show another image" }))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("shows just the title (no image, link, or actions) while the catalog loads", () => {
    mockPick({ status: "loading" })
    const { container } = renderWithLocale(<InspirationImage />)
    expect(screen.getByText("Inspiration")).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })
})

const FIXTURE: Quote[] = [
  {
    id: "carroll-0001",
    author: "Lewis Carroll",
    source: "Alice's Adventures in Wonderland",
    kind: "dialogue",
    lang_source: "en",
    origin: { file: "x", md5: "y", char_start: 0, char_end: 1 },
    text: { en: ["Curiouser and curiouser!"], es: ["¡Cada vez más raro!"] },
  },
]

describe("QuoteOfDay", () => {
  afterEach(() => vi.restoreAllMocks())

  it("shows the quote-of-the-day header, today's quote, and attribution", async () => {
    vi.spyOn(quotesModule, "loadQuotes").mockResolvedValue(FIXTURE)
    renderWithLocale(<QuoteOfDay />)
    expect(screen.getByText("Quote of the day")).toBeInTheDocument()
    expect(await screen.findByText("Curiouser and curiouser!")).toBeInTheDocument()
    expect(screen.getByText(/Lewis Carroll · Alice's Adventures in Wonderland/)).toBeInTheDocument()
  })

  it("renders the localized text for the active locale", async () => {
    vi.spyOn(quotesModule, "loadQuotes").mockResolvedValue(FIXTURE)
    renderWithLocale(<QuoteOfDay />, { locale: "es" })
    expect(await screen.findByText("¡Cada vez más raro!")).toBeInTheDocument()
  })

  it("renders nothing when the pool is unavailable", async () => {
    vi.spyOn(quotesModule, "loadQuotes").mockResolvedValue(null)
    const { container } = renderWithLocale(<QuoteOfDay />)
    // Wait a tick for the effect to resolve, then the card is gone.
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})

describe("ShowAllButton", () => {
  it("names the target section for assistive tech and fires onClick", async () => {
    const onClick = vi.fn()
    renderWithLocale(
      <ShowAllButton label="Show all" sectionName="Statistics" onClick={onClick} />,
    )
    const button = screen.getByRole("button", { name: "Show all: Statistics" })
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
