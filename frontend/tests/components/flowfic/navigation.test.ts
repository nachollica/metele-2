import { describe, expect, it } from "vitest"

import { pathToScreen, screenToPath, type Screen } from "@/components/flowfic/navigation"

describe("pathToScreen", () => {
  it("maps the known section and content paths", () => {
    expect(pathToScreen("/")).toEqual({ name: "landing" })
    expect(pathToScreen("/new")).toEqual({ name: "configuring" })
    expect(pathToScreen("/profile")).toEqual({ name: "profile" })
    expect(pathToScreen("/stories")).toEqual({ name: "section", section: "stories" })
    expect(pathToScreen("/progress")).toEqual({ name: "section", section: "progress" })
  })

  it("maps the retired section paths to not-found", () => {
    expect(pathToScreen("/challenges")).toEqual({ name: "notfound" })
    expect(pathToScreen("/stats")).toEqual({ name: "notfound" })
    // "My Journey" was renamed to "My Progress", route and all — the old path
    // is deliberately not redirected.
    expect(pathToScreen("/journey")).toEqual({ name: "notfound" })
  })

  it("parses a numeric story id", () => {
    expect(pathToScreen("/stories/42")).toEqual({ name: "story", id: 42 })
  })

  it("parses a connect invite token", () => {
    expect(pathToScreen("/connect/aBc123_-XYZ")).toEqual({
      name: "connect",
      token: "aBc123_-XYZ",
    })
  })

  it("tolerates a trailing slash", () => {
    expect(pathToScreen("/stories/")).toEqual({ name: "section", section: "stories" })
    expect(pathToScreen("/stories/42/")).toEqual({ name: "story", id: 42 })
    expect(pathToScreen("/connect/abc123/")).toEqual({ name: "connect", token: "abc123" })
  })

  it("maps unknown paths (incl. non-numeric story ids and a dotted invite token) to not-found", () => {
    expect(pathToScreen("/nope")).toEqual({ name: "notfound" })
    expect(pathToScreen("/stories/abc")).toEqual({ name: "notfound" })
    expect(pathToScreen("/stories/42/extra")).toEqual({ name: "notfound" })
    // A token can never actually contain a dot (`secrets.token_urlsafe`
    // output is URL-safe base64) — this just documents that the regex would
    // reject one if it somehow did, rather than accidentally matching a
    // dotted, non-app path.
    expect(pathToScreen("/connect/abc.123")).toEqual({ name: "notfound" })
    expect(pathToScreen("/connect/")).toEqual({ name: "notfound" })
  })
})

describe("screenToPath", () => {
  it("maps addressable screens to their path", () => {
    expect(screenToPath({ name: "landing" })).toBe("/")
    expect(screenToPath({ name: "configuring" })).toBe("/new")
    expect(screenToPath({ name: "profile" })).toBe("/profile")
    expect(screenToPath({ name: "section", section: "stories" })).toBe("/stories")
    expect(screenToPath({ name: "section", section: "progress" })).toBe("/progress")
    expect(screenToPath({ name: "story", id: 7 })).toBe("/stories/7")
    expect(screenToPath({ name: "connect", token: "abc123" })).toBe("/connect/abc123")
  })

  it("returns null for the pathless not-found screen", () => {
    expect(screenToPath({ name: "notfound" })).toBeNull()
  })
})

describe("round-trip", () => {
  it("path -> screen -> path is stable for addressable paths", () => {
    for (const path of [
      "/",
      "/new",
      "/profile",
      "/stories",
      "/progress",
      "/stories/13",
      "/connect/abc123",
    ]) {
      const screen = pathToScreen(path) as Screen
      expect(screenToPath(screen)).toBe(path)
    }
  })
})
