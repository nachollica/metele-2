import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InspirationImage, QuoteOfDay } from "@/components/flowfic/inspiration-panel"
import { ShowAllButton } from "@/components/flowfic/dashboard-widgets"
import * as quotesModule from "@/lib/flowfic/quotes"
import type { Quote } from "@/lib/flowfic/quotes"
import { renderWithLocale } from "../../utils"

describe("InspirationImage", () => {
  it("renders a titled card with a landscape placeholder image", () => {
    renderWithLocale(<InspirationImage />)
    expect(screen.getByText("Today's inspiration")).toBeInTheDocument()
    const img = screen.getByRole("img", { name: "Inspiration image" })
    expect(img).toHaveAttribute("src", expect.stringContaining("picsum"))
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
