import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, type ChangeEvent } from "react"
import { describe, expect, it } from "vitest"

import { WritingArea } from "@/components/metele/writing-area"
import type { MatchedRange } from "@/lib/metele/types"

import { renderWithLocale } from "@/tests/utils"

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <WritingArea
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
      matches={[]}
    />
  )
}

describe("WritingArea", () => {
  it("appends typed characters", async () => {
    renderWithLocale(<Harness />)
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement
    const user = userEvent.setup()
    await user.click(ta)
    await user.keyboard("hello")
    expect(ta.value).toBe("hello")
  })

  it("blocks Backspace so the user can't delete prior text", async () => {
    renderWithLocale(<Harness initial="abc" />)
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
    const user = userEvent.setup()
    await user.keyboard("{Backspace}")
    expect(ta.value).toBe("abc")
  })

  it("blocks arrow keys so the cursor stays at the end", async () => {
    renderWithLocale(<Harness initial="abcdef" />)
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
    const user = userEvent.setup()
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}X")
    // Cursor was blocked from moving, so X gets appended at the end.
    expect(ta.value).toBe("abcdefX")
  })

  it("renders highlight ranges in the backdrop", () => {
    const matches: MatchedRange[] = [{ start: 0, end: 5 }]
    renderWithLocale(
      <WritingArea value="hello world" onChange={() => {}} matches={matches} />,
    )
    const marks = document.querySelectorAll("mark")
    expect(marks.length).toBe(1)
    expect(marks[0]?.textContent).toBe("hello")
  })
})
