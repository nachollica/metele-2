import { describe, expect, it } from "vitest"

import { screenHeader } from "@/components/flowfic/screen-header"
import { getTranslations } from "@/lib/i18n"

const t = getTranslations("en")

describe("screenHeader", () => {
  it("names the landing after what it is for, with no back arrow", () => {
    expect(screenHeader({ name: "landing" }, t)).toEqual({
      title: "Create a story",
      backTo: null,
      backLabel: null,
    })
  })

  it("treats the open settings panel as the same screen", () => {
    expect(screenHeader({ name: "configuring" }, t)).toEqual(screenHeader({ name: "landing" }, t))
  })

  it("takes a section title from the section metadata", () => {
    expect(screenHeader({ name: "section", section: "stories" }, t)).toEqual({
      title: "My stories",
      backTo: "home",
      backLabel: "Back to home",
    })
    expect(screenHeader({ name: "section", section: "progress" }, t).title).toBe("My Progress")
  })

  it("returns home from the profile", () => {
    expect(screenHeader({ name: "profile" }, t)).toEqual({
      title: "Your profile",
      backTo: "home",
      backLabel: "Back to home",
    })
  })

  it("returns to the stories list from a single story", () => {
    expect(screenHeader({ name: "story", id: 7 }, t)).toEqual({
      title: "Viewing a previous story (read-only).",
      backTo: "stories",
      backLabel: "Back to my stories",
    })
  })

  it("shows not-found for a story id that doesn't resolve, still returning to the list", () => {
    expect(screenHeader({ name: "story", id: 7 }, t, { storyMissing: true })).toEqual({
      title: "Page not found",
      backTo: "stories",
      backLabel: "Back to my stories",
    })
  })

  it("returns home from an unknown path", () => {
    expect(screenHeader({ name: "notfound" }, t)).toEqual({
      title: "Page not found",
      backTo: "home",
      backLabel: "Back to home",
    })
  })
})
