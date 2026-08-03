import { describe, expect, it } from "vitest"

import { pathToScreen, screenToPath, type Screen } from "@/components/flowfic/navigation"

describe("pathToScreen", () => {
  it("maps the known section and content paths", () => {
    expect(pathToScreen("/")).toEqual({ name: "landing" })
    expect(pathToScreen("/new")).toEqual({ name: "configuring" })
    expect(pathToScreen("/profile")).toEqual({ name: "profile" })
    expect(pathToScreen("/stories")).toEqual({ name: "section", section: "stories" })
    expect(pathToScreen("/challenges")).toEqual({ name: "section", section: "challenges" })
    expect(pathToScreen("/stats")).toEqual({ name: "section", section: "stats" })
  })

  it("parses a numeric story id", () => {
    expect(pathToScreen("/stories/42")).toEqual({ name: "story", id: 42 })
  })

  it("tolerates a trailing slash", () => {
    expect(pathToScreen("/stories/")).toEqual({ name: "section", section: "stories" })
    expect(pathToScreen("/stories/42/")).toEqual({ name: "story", id: 42 })
  })

  it("maps unknown paths (incl. non-numeric story ids) to not-found", () => {
    expect(pathToScreen("/nope")).toEqual({ name: "notfound" })
    expect(pathToScreen("/stories/abc")).toEqual({ name: "notfound" })
    expect(pathToScreen("/stories/42/extra")).toEqual({ name: "notfound" })
  })
})

describe("screenToPath", () => {
  it("maps addressable screens to their path", () => {
    expect(screenToPath({ name: "landing" })).toBe("/")
    expect(screenToPath({ name: "configuring" })).toBe("/new")
    expect(screenToPath({ name: "profile" })).toBe("/profile")
    expect(screenToPath({ name: "section", section: "stories" })).toBe("/stories")
    expect(screenToPath({ name: "section", section: "stats" })).toBe("/stats")
    expect(screenToPath({ name: "story", id: 7 })).toBe("/stories/7")
  })

  it("returns null for the pathless not-found screen", () => {
    expect(screenToPath({ name: "notfound" })).toBeNull()
  })
})

describe("round-trip", () => {
  it("path -> screen -> path is stable for addressable paths", () => {
    for (const path of ["/", "/new", "/profile", "/stories", "/challenges", "/stats", "/stories/13"]) {
      const screen = pathToScreen(path) as Screen
      expect(screenToPath(screen)).toBe(path)
    }
  })
})
