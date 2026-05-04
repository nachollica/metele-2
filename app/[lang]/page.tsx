import { MeteleGame } from "@/components/metele/metele-game"
import { SUPPORTED_LOCALES } from "@/lib/i18n/config"

export function generateStaticParams(): { lang: string }[] {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }))
}

// All gameplay logic lives in the client `MeteleGame` component so the
// entire app can be served as static assets.
export default function Page() {
  return <MeteleGame />
}
