"use client"

import { cn } from "@/lib/utils"

import { useTranslations } from "@/lib/i18n"

import { NAV_ITEMS, type Section } from "./dashboard-nav"
import { PrefsControls } from "./prefs-controls"

type Props = {
  active: Section
  onSelect: (section: Section) => void
  /** While a sprint is running, nav is present but not actionable. */
  disabled?: boolean
}

export function DashboardSidebar({ active, onSelect, disabled = false }: Props) {
  const t = useTranslations()

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      {/* Brand */}
      <div className="flex justify-center px-2 pt-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/flowfic-logo-full.png" alt={t.app.title} className="h-auto w-3/5 max-w-full" />
      </div>

      {/* Nav */}
      <nav aria-label={t.nav.label}>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === active
            const Icon = item.icon
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  disabled={disabled}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-foreground/80 hover:bg-accent/40 disabled:opacity-50",
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {item.label(t)}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex-1" />

      {/* Language + light/dark controls sit alone in the bottom-left corner;
          login and profile moved to the top-right header. */}
      <PrefsControls />
    </div>
  )
}
