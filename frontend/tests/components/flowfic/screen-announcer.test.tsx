import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  ScreenAnnouncer,
  screenDocumentTitle,
} from "@/components/flowfic/screen-announcer"

import { renderWithLocale } from "@/tests/utils"

describe("screenDocumentTitle", () => {
  it("suffixes the screen title with the app name", () => {
    expect(screenDocumentTitle("My stories")).toBe("My stories — Flowfic")
  })

  it("falls back to the bare app name for the sprint", () => {
    expect(screenDocumentTitle(null)).toBe("Flowfic")
  })
})

describe("ScreenAnnouncer", () => {
  it("writes the screen title to the document, but stays silent on first paint", () => {
    renderWithLocale(<ScreenAnnouncer title="Create a story" />)

    expect(document.title).toBe("Create a story — Flowfic")
    // A page load announces itself; only a client-side navigation needs help.
    expect(screen.getByRole("status")).toHaveTextContent("")
  })

  it("announces the new screen after a client-side navigation", () => {
    const { rerender } = renderWithLocale(<ScreenAnnouncer title="Create a story" />)

    rerender(<ScreenAnnouncer title="My stories" />)

    expect(document.title).toBe("My stories — Flowfic")
    expect(screen.getByRole("status")).toHaveTextContent("My stories")
  })

  it("says nothing when the screen keeps its title", () => {
    // The landing and the open settings panel are one screen under two URLs.
    const { rerender } = renderWithLocale(<ScreenAnnouncer title="Create a story" />)

    rerender(<ScreenAnnouncer title="Create a story" />)

    expect(screen.getByRole("status")).toHaveTextContent("")
  })

  it("leaves the sprint to announce itself", () => {
    const { rerender } = renderWithLocale(<ScreenAnnouncer title="Create a story" />)

    rerender(<ScreenAnnouncer title={null} />)

    expect(document.title).toBe("Flowfic")
    expect(screen.getByRole("status")).toHaveTextContent("")
  })
})
