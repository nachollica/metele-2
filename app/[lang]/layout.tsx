import type { Metadata } from "next"
import { Geist, Lora } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "../globals.css"

import { resolveLocale } from "@/lib/i18n/config"
import { LocaleProvider } from "@/lib/i18n/locale-provider"

// Reject any path segment that isn't a supported locale. Without this,
// requests like /favicon.ico would be parsed as { lang: "favicon.ico" }.
// `generateStaticParams` lives on the leaf page (page.tsx) since the
// page is a server component while the layout is shared.
export const dynamicParams = false

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

export default async function LangLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ lang: string }>
}>) {
  const { lang } = await params
  const locale = resolveLocale(lang)

  return (
    <html lang={locale} className={`${geist.variable} ${lora.variable} bg-background`}>
      <body className="font-sans antialiased">
        <LocaleProvider locale={locale}>
          {children}
        </LocaleProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
