import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"

import { DEFAULT_LOCALE } from "@/lib/i18n/config"
import { LocaleProvider } from "@/lib/i18n/locale-provider"
import { BackendStatusProvider } from "@/lib/backend"
import { AuthProvider } from "@/lib/auth"
import { PreferencesProvider } from "@/lib/preferences"
import { ThemeProvider } from "@/components/theme-provider"
import { BfcacheGuard } from "@/components/bfcache-guard"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

export const metadata: Metadata = {
  title: "Flowfic",
  description: "¡Escribe sin parar!",
  icons: { icon: "/icon.svg" },
  // The app ships its own light/dark themes, so opt out of dark-mode browser
  // extensions (Dark Reader et al.). They re-theme by parsing computed colors,
  // choke on our `oklch()`/`lab()` values, and drop element backgrounds —
  // which rendered the welcome modal see-through on affected setups.
  // Next omits a meta whose content is an empty string, so give it a truthy
  // value; Dark Reader keys off the tag's name, not its content.
  other: { "darkreader-lock": "true" },
}

// Initial `<html lang>` uses the default locale; `LocaleProvider` detects the
// browser locale client-side and updates `document.documentElement.lang` after
// mount. A future language dropdown can call into the same provider.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${geist.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <BfcacheGuard />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            <BackendStatusProvider>
              <AuthProvider>
                <PreferencesProvider>{children}</PreferencesProvider>
              </AuthProvider>
            </BackendStatusProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
