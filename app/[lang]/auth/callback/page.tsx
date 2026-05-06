import { SUPPORTED_LOCALES } from "@/lib/i18n/config"

import { CallbackClient } from "./callback-client"

export function generateStaticParams(): { lang: string }[] {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }))
}

export default function CallbackPage() {
  return <CallbackClient />
}
