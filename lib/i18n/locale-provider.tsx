"use client"

import type { ReactNode } from "react"
import { LocaleContext, type Locale } from "@/lib/i18n"

/**
 * Client component that provides the resolved locale to all descendants
 * via React context. Used in the `[lang]/layout.tsx`.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  return (
    <LocaleContext value={locale}>
      {children}
    </LocaleContext>
  )
}
