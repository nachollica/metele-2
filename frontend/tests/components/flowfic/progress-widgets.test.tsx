import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  AchievementHighlights,
  highlightAchievements,
  ProgressHighlights,
} from "@/components/flowfic/progress-widgets"
import { emptyOverview, type Achievement, type Overview } from "@/lib/flowfic/gamification"

import { renderWithLocale } from "@/tests/utils"

function achievement(id: string, over: Partial<Achievement> = {}): Achievement {
  return { id, unlocked: false, current: 0, target: 10, progress: 0, ...over }
}

function overview(over: Partial<Overview> = {}): Overview {
  return { ...emptyOverview(), ...over }
}

describe("highlightAchievements", () => {
  // There is no unlock time in the payload, so "recent" means latest-earned in
  // the backend's fixed easiest-to-hardest order — the closest honest reading.
  it("puts the latest unlocked first, newest of those leading", () => {
    const picked = highlightAchievements([
      achievement("first_session", { unlocked: true, progress: 1 }),
      achievement("streak_7", { unlocked: true, progress: 1 }),
      achievement("wordsmith", { unlocked: true, progress: 1 }),
      achievement("marathon", { progress: 0.4 }),
    ])
    expect(picked.map((a) => a.id)).toEqual(["wordsmith", "streak_7", "first_session"])
  })

  it("fills a shortfall with the locked ones closest to unlocking", () => {
    const picked = highlightAchievements([
      achievement("first_session", { unlocked: true, progress: 1 }),
      achievement("wordsmith", { progress: 0.25 }),
      achievement("marathon", { progress: 0.8 }),
      achievement("night_owl", { progress: 0.1 }),
    ])
    expect(picked.map((a) => a.id)).toEqual(["first_session", "marathon", "wordsmith"])
  })

  it("never returns more than the three the card has room for", () => {
    const picked = highlightAchievements(
      ["a", "b", "c", "d", "e"].map((id) => achievement(id, { unlocked: true, progress: 1 })),
    )
    expect(picked).toHaveLength(3)
  })
})

describe("AchievementHighlights", () => {
  it("names each badge, marking the locked ones with their progress", () => {
    renderWithLocale(
      <AchievementHighlights
        achievements={[
          achievement("first_session", { unlocked: true, current: 1, target: 1, progress: 1 }),
          achievement("wordsmith", { current: 2500, target: 10000, progress: 0.25 }),
        ]}
      />,
    )
    // An unlocked badge is named plainly; a locked one carries how far along it
    // is, so the card is readable without colour.
    expect(screen.getByRole("img", { name: "First step" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Wordsmith — 2500/10000" })).toBeInTheDocument()
    expect(screen.getByText("1 of 2 unlocked")).toBeInTheDocument()
  })

  it("renders nothing at all before the achievements load", () => {
    const { container } = renderWithLocale(<AchievementHighlights achievements={[]} />)
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
