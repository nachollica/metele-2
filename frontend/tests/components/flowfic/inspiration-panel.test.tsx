import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InspirationCard, InspirationPane } from "@/components/flowfic/inspiration-panel"
import { ShowAllButton } from "@/components/flowfic/dashboard-widgets"
import type { Quote } from "@/lib/flowfic/quotes"
import * as inspirationModule from "@/lib/flowfic/inspiration"
import type { InspirationImageData, InspirationState } from "@/lib/flowfic/inspiration"
import { renderWithLocale } from "../../utils"

const IMAGE: InspirationImageData = {
  title: "and the ship sails on",
  loc: "https://film-grab.com/2014/12/12/and-the-ship-sails-on/",
  img: "https://film-grab.com/wp-content/uploads/And-The-Ship-01.jpg",
}

const QUOTE: Quote = {
  id: "carroll-0001",
  author: "Lewis Carroll",
  source: "Alice's Adventures in Wonderland",
  kind: "dialogue",
  lang_source: "en",
  origin: { file: "x", md5: "y", char_start: 0, char_end: 1 },
  text: { en: ["Curiouser and curiouser!"], es: ["¡Cada vez más raro!"] },
}

function mockStore(state: InspirationState, pick = vi.fn()): ReturnType<typeof vi.fn> {
  vi.spyOn(inspirationModule, "useInspiration").mockReturnValue({
    state,
    pick,
    clear: vi.fn(),
  })
  return pick
}

describe("InspirationCard", () => {
  afterEach(() => vi.restoreAllMocks())

  it("invites a first pick while unset, and picking is the whole card", async () => {
    const pick = mockStore({ status: "unset" })
    const { container } = renderWithLocale(<InspirationCard />)

    const card = screen.getByRole("button", { name: "Click here to get some inspiration" })
    expect(screen.getByText("Click here to get some inspiration")).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()

    await userEvent.click(card)
    expect(pick).toHaveBeenCalledOnce()
  })

  it("renders a picked image and offers a re-roll", async () => {
    const pick = mockStore({ status: "image", image: IMAGE })
    const { container } = renderWithLocale(<InspirationCard />)

    expect(container.querySelector("img")).toHaveAttribute("src", IMAGE.img)
    // No title, credit link, or separate refresh control by design.
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.queryByText(IMAGE.title)).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Show me another inspiration" }))
    expect(pick).toHaveBeenCalledOnce()
  })

  it("renders a picked quote with its attribution", () => {
    mockStore({ status: "quote", quote: QUOTE })
    renderWithLocale(<InspirationCard />)
    expect(screen.getByText("Curiouser and curiouser!")).toBeInTheDocument()
    expect(
      screen.getByText(/Lewis Carroll · Alice's Adventures in Wonderland/),
    ).toBeInTheDocument()
  })

  it("renders the localized quote text for the active locale", () => {
    mockStore({ status: "quote", quote: QUOTE })
    renderWithLocale(<InspirationCard />, { locale: "es" })
    expect(screen.getByText("¡Cada vez más raro!")).toBeInTheDocument()
  })

  it("says so when neither pool is available", () => {
    mockStore({ status: "unavailable" })
    renderWithLocale(<InspirationCard />)
    expect(screen.getByText("No inspiration available right now.")).toBeInTheDocument()
  })
})

describe("InspirationPane", () => {
  afterEach(() => vi.restoreAllMocks())

  it("shows the zoomable image viewport for an image pick", () => {
    mockStore({ status: "image", image: IMAGE })
    const { container } = renderWithLocale(<InspirationPane />)
    expect(
      screen.getByRole("img", { name: `Inspiration image: ${IMAGE.title}` }),
    ).toBeInTheDocument()
    expect(container.querySelector("img")).toHaveAttribute("src", IMAGE.img)
  })

  it("shows a static quote (no zoom viewport) for a quote pick", () => {
    mockStore({ status: "quote", quote: QUOTE })
    renderWithLocale(<InspirationPane />)
    expect(screen.getByText("Curiouser and curiouser!")).toBeInTheDocument()
    expect(screen.queryByRole("img")).toBeNull()
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
