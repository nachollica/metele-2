import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"

import { LocaleContext, type Locale } from "@/lib/i18n"

type Options = Omit<RenderOptions, "wrapper"> & {
  locale?: Locale
}

export function renderWithLocale(ui: ReactElement, options: Options = {}) {
  const { locale = "en", ...rest } = options
  function Wrapper({ children }: { children: ReactNode }) {
    return <LocaleContext value={locale}>{children}</LocaleContext>
  }
  return render(ui, { wrapper: Wrapper, ...rest })
}
