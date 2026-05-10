import type { Metadata } from "next"
import { Geist, Lora } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

import { DEFAULT_LOCALE } from "@/lib/i18n/config"
import { LocaleProvider } from "@/lib/i18n/locale-provider"
import { AuthProvider } from "@/lib/auth"
import { PreferencesProvider } from "@/lib/preferences"
import { ThemeProvider } from "@/components/theme-provider"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
})

export const metadata: Metadata = {
  title: "METELE — A Writing Game",
  description: "Train your storytelling under pressure. Keep typing, weave in surprise words, finish strong.",
  generator: "v0.app",
  icons: { icon: "/icon.svg" },
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
      className={`${geist.variable} ${lora.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            <AuthProvider>
              <PreferencesProvider>{children}</PreferencesProvider>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
