import { redirect } from "next/navigation"
import { DEFAULT_LOCALE } from "@/lib/i18n/config"

// Root page redirects to the default locale.
export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`)
}
