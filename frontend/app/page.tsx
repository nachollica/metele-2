import { FlowficGameClient } from "@/components/flowfic/flowfic-game-client"

// The app is one static route. Its stable screens are addressable by URL
// (see components/flowfic/navigation.ts) via client-side History API routing;
// there are no per-section route files. In production Caddy serves this shell
// (index.html) for every app path (prod/conf/Caddyfile); in `next dev` the
// dev-only rewrites in next.config.mjs do the same, so a hard refresh / deep
// link at e.g. /stories works in both. `/auth/callback` stays its own route.
//
// All gameplay logic lives in the client `FlowficGameClient` component so the
// entire app can be served as static assets. The wrapper dynamic-imports it
// with `ssr: false` so auth state (read from localStorage post-mount) can't
// desync between server HTML and the first client render.
export default function Page() {
  return <FlowficGameClient />
}
