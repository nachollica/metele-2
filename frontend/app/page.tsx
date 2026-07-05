import { FlowficGameClient } from "@/components/flowfic/flowfic-game-client"

// All gameplay logic lives in the client `FlowficGame` component so the
// entire app can be served as static assets. The wrapper dynamic-imports
// it with `ssr: false` so auth state (read from localStorage post-mount)
// can't desync between server HTML and the first client render.
export default function Page() {
  return <FlowficGameClient />
}
