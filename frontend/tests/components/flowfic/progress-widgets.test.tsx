import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AchievementsStrip, ProgressHighlights } from "@/components/flowfic/progress-widgets"
import { emptyOverview, type Achievement, type Overview } from "@/lib/flowfic/gamification"

import { renderWithLocale } from "@/tests/utils"

function achievement(id: string, over: Partial<Achievement> = {}): Achievement {
  return { id, unlocked: false, current: 0, target: 10, progress: 0, ...over }
}

function overview(over: Partial<Overview> = {}): Overview {
  return { ...emptyOverview(), ...over }
}

describe("AchievementsStrip", () => {
  it("names every badge, marking the locked ones with their progress", () => {
    renderWithLocale(
      <AchievementsStrip
        achievements={[
          achievement("first_session", { unlocked: true, current: 1, target: 1, progress: 1 }),
          achievement("wordsmith", { current: 2500, target: 10000, progress: 0.25 }),
        ]}
      />,
    )
    // An unlocked badge is named plainly; a locked one carries how far along it
    // is, so the row is readable without colour.
    expect(screen.getByRole("img", { name: "First step" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Wordsmith — 2500/10000" })).toBeInTheDocument()
    expect(screen.getByText("1 of 2 unlocked")).toBeInTheDocument()
  })

  it("calls out the locked achievement closest to unlocking", () => {
    renderWithLocale(
      <AchievementsStrip
        achievements={[
          achievement("first_session", { unlocked: true, progress: 1 }),
          achievement("wordsmith", { progress: 0.25 }),
          // Furthest along of the locked ones, though listed last.
          achievement("marathon", { current: 4, target: 5, progress: 0.8 }),
        ]}
      />,
    )
    expect(screen.getByText("Next up: Marathoner")).toBeInTheDocument()
    expect(screen.getByText("4/5")).toBeInTheDocument()
  })

  it("drops the next-up line once everything is unlocked", () => {
    renderWithLocale(
      <AchievementsStrip
        achievements={[achievement("first_session", { unlocked: true, progress: 1 })]}
      />,
    )
    expect(screen.queryByText(/Next up/)).toBeNull()
  })

  it("renders nothing at all before the achievements load", () => {
    const { container } = renderWithLocale(<AchievementsStrip achievements={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("ProgressHighlights", () => {
  it("shows the level with its bar toward the next one", () => {
    renderWithLocale(
      <ProgressHighlights
        overview={overview({
          level: { level: 4, totalXp: 1500, xpIntoLevel: 150, xpForLevel: 600 },
          streak: 9,
        })}
      />,
    )
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("9")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Level 4" })).toHaveAttribute(
      "aria-valuenow",
      "25",
    )
  })

  it("survives a zero-XP level without dividing by zero", () => {
    renderWithLocale(
      <ProgressHighlights
        overview={overview({ level: { level: 1, totalXp: 0, xpIntoLevel: 0, xpForLevel: 0 } })}
      />,
    )
    expect(screen.getByRole("progressbar", { name: "Level 1" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    )
  })
})
