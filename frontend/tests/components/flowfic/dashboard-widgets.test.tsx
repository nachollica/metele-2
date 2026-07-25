import { render, screen } from "@testing-library/react"
import { Flame } from "lucide-react"
import { describe, expect, it } from "vitest"

import {
  AchievementItem,
  ChallengeItem,
  ProgressMeter,
  StatTile,
} from "@/components/flowfic/dashboard-widgets"

describe("AchievementItem", () => {
  it("shows a check when unlocked and no progress badge", () => {
    render(
      <AchievementItem
        icon={Flame}
        tone="orange"
        name="Consistent writer"
        description="7 days"
        unlocked
        current={7}
        target={7}
        progress={1}
      />,
    )
    expect(screen.getByText("Consistent writer")).toBeInTheDocument()
    expect(screen.queryByText("7/7")).not.toBeInTheDocument()
  })

  it("shows a current/target badge while locked", () => {
    render(
      <AchievementItem
        icon={Flame}
        tone="orange"
        name="Consistent writer"
        description="7 days"
        unlocked={false}
        current={3}
        target={7}
        progress={3 / 7}
      />,
    )
    expect(screen.getByText("3/7")).toBeInTheDocument()
  })
})

describe("StatTile", () => {
  it("renders value, label and a positive delta", () => {
    render(<StatTile value="3,250" label="words" delta="+12%" deltaPositive />)
    expect(screen.getByText("3,250")).toBeInTheDocument()
    expect(screen.getByText("words")).toBeInTheDocument()
    expect(screen.getByText("+12%")).toBeInTheDocument()
  })
})

describe("ChallengeItem", () => {
  it("shows the completed label instead of the action once met", () => {
    render(
      <ChallengeItem
        icon={Flame}
        tone="violet"
        name="Daily sprint"
        description="600 words"
        progress={1}
        completed
        progressLabel="600/600"
        completedLabel="Completed"
        action={<button>Write now</button>}
      />,
    )
    expect(screen.getByText("Completed")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Write now" })).not.toBeInTheDocument()
  })

  it("shows the action while incomplete", () => {
    render(
      <ChallengeItem
        icon={Flame}
        tone="violet"
        name="Daily sprint"
        description="600 words"
        progress={0.4}
        completed={false}
        progressLabel="250/600"
        completedLabel="Completed"
        action={<button>Write now</button>}
      />,
    )
    expect(screen.getByRole("button", { name: "Write now" })).toBeInTheDocument()
  })
})

describe("ProgressMeter", () => {
  it("clamps and reports its value via ARIA", () => {
    render(<ProgressMeter value={1.5} label="XP" />)
    const bar = screen.getByRole("progressbar", { name: "XP" })
    expect(bar).toHaveAttribute("aria-valuenow", "100")
  })
})
