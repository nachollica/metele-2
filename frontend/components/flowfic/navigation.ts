// URL <-> screen mapping for the single-route SPA.
//
// The app ships as one static bundle, but the stable content screens are
// addressable by real paths so the browser Back/Forward buttons, a refresh,
// and deep links all work. Navigation is driven client-side via the History
// API (pushState/popstate in `dashboard.tsx`); Caddy serves the app shell for
// any of these paths (see `prod/conf/Caddyfile`), and a dev-only catch-all
// rewrite in `next.config.mjs` does the same under `next dev`.
//
// Kept framework-light (no JSX / React) so both the shell and its unit tests
// can import the pure mapping.

import type { Section } from "./dashboard-nav"

// The visible main-area screen. Engine states (loading/playing/ended) take
// precedence over this and render the game regardless of screen.
export type Screen =
  | { name: "landing" }
  | { name: "configuring" } // session settings shown, engine still idle
  | { name: "section"; section: Section }
  | { name: "profile" }
  | { name: "story"; id: number }
  | { name: "notfound" }

const SECTION_PATH: Record<Section, string> = {
  stories: "/stories",
  journey: "/journey",
}

// Path for the screen, or null when the screen owns no canonical URL:
//   - `notfound` keeps whatever (unknown) path the user landed on, so a
//     refresh still renders not-found rather than bouncing home.
export function screenToPath(screen: Screen): string | null {
  switch (screen.name) {
    case "landing":
      return "/"
    case "configuring":
      return "/new"
    case "profile":
      return "/profile"
    case "section":
      return SECTION_PATH[screen.section]
    case "story":
      return `/stories/${screen.id}`
    case "notfound":
      return null
  }
}

// Resolve a location pathname to a screen. Unknown paths map to `notfound`.
// Query string and hash are the caller's responsibility to strip (pass
// `window.location.pathname`).
export function pathToScreen(pathname: string): Screen {
  // Normalise a trailing slash away, but keep the root as "/".
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  switch (path) {
    case "":
    case "/":
      return { name: "landing" }
    case "/new":
      return { name: "configuring" }
    case "/profile":
      return { name: "profile" }
    case "/stories":
      return { name: "section", section: "stories" }
    case "/journey":
      return { name: "section", section: "journey" }
  }
  const storyMatch = /^\/stories\/(\d+)$/.exec(path)
  if (storyMatch) return { name: "story", id: Number(storyMatch[1]) }
  return { name: "notfound" }
}
