import { MeteleGameClient } from "@/components/metele/metele-game-client"
import { SUPPORTED_LOCALES } from "@/lib/i18n/config"

export function generateStaticParams(): { lang: string }[] {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }))
}

// All gameplay logic lives in the client `MeteleGame` component so the
// entire app can be served as static assets. The wrapper dynamic-imports
// it with `ssr: false` so auth state (read from localStorage post-mount)
// can't desync between server HTML and the first client render.
export default function Page() {
  return <MeteleGameClient />
}
