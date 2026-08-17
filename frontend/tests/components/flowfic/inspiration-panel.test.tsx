import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { InspirationDisplay, InspirationPane } from "@/components/flowfic/inspiration-panel"
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

describe("InspirationDisplay", () => {
  afterEach(() => vi.restoreAllMocks())

  it("shows the spinner while unset, since a pick is already on its way", () => {
    mockStore({ status: "unset" })
    const { container } = renderWithLocale(<InspirationDisplay />)

    // Selecting the face fills an empty store, so `unset` is a frame or two in
    // transit rather than a resting state needing its own invitation.
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
  })

  it("renders a picked image, inert — the selector above owns the re-roll", () => {
    mockStore({ status: "image", image: IMAGE })
    const { container } = renderWithLocale(<InspirationDisplay />)

    expect(container.querySelector("img")).toHaveAttribute("src", IMAGE.img)
    // Nothing here is clickable: a click in the pane must not re-roll, which is
    // also what leaves a quote's text selectable.
    expect(screen.queryByRole("button")).toBeNull()
    // No title or credit link by design.
    expect(screen.queryByRole("link")).toBeNull()
    expect(screen.queryByText(IMAGE.title)).toBeNull()
  })

  it("renders a picked quote with its attribution", () => {
    mockStore({ status: "quote", quote: QUOTE })
    renderWithLocale(<InspirationDisplay />)
    expect(screen.getByText("Curiouser and curiouser!")).toBeInTheDocument()
    expect(
      screen.getByText(/Lewis Carroll · Alice's Adventures in Wonderland/),
    ).toBeInTheDocument()
  })

  it("renders the localized quote text for the active locale", () => {
    mockStore({ status: "quote", quote: QUOTE })
    renderWithLocale(<InspirationDisplay />, { locale: "es" })
    expect(screen.getByText("¡Cada vez más raro!")).toBeInTheDocument()
  })

  it("says so when neither pool is available", () => {
    mockStore({ status: "unavailable" })
    renderWithLocale(<InspirationDisplay />)
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
