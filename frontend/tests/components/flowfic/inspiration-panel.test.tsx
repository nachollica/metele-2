import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { InspirationImage, PromptOfDay } from "@/components/flowfic/inspiration-panel"
import { ShowAllButton } from "@/components/flowfic/dashboard-widgets"
import { renderWithLocale } from "../../utils"

describe("InspirationImage", () => {
  it("renders a landscape placeholder image with localized alt text", () => {
    renderWithLocale(<InspirationImage />)
    const img = screen.getByRole("img", { name: "Inspiration image" })
    expect(img).toHaveAttribute("src", expect.stringContaining("picsum"))
  })
})

describe("PromptOfDay", () => {
  it("shows the prompt-of-the-day header", () => {
    renderWithLocale(<PromptOfDay />)
    expect(screen.getByText("Prompt of the day")).toBeInTheDocument()
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
