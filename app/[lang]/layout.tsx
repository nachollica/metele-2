import type { Metadata } from "next"
import { Geist, Lora } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "../globals.css"

import { resolveLocale } from "@/lib/i18n/config"
import { LocaleProvider } from "@/lib/i18n/locale-provider"

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

export function generateStaticParams(): { lang: string }[] {
  return [
    { lang: 'en' },
    { lang: 'es' }
  ];
}
