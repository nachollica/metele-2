"use client"

import { Flame } from "lucide-react"

import { cn } from "@/lib/utils"

import { useTranslations } from "@/lib/i18n"

import { NAV_ITEMS, type Section } from "./dashboard-nav"
import { PrefsControls } from "./prefs-controls"
import { SidebarAccount } from "./sidebar-account"
import { useGamification } from "./gamification-context"

type Props = {
  active: Section
  onSelect: (section: Section) => void
  /** Opens the profile screen from the account menu. */
  onOpenProfile?: () => void
  /** While a sprint is running, nav + account are present but not actionable. */
  disabled?: boolean
}

export function DashboardSidebar({ active, onSelect, onOpenProfile, disabled = false }: Props) {
  const t = useTranslations()
  const { overview } = useGamification()

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

      {/* Streak card */}
      <div className="flex items-center gap-3 rounded-2xl border border-orange-300/50 bg-orange-50 p-3 dark:border-orange-500/25 dark:bg-orange-500/10">
        <Flame className="size-5 shrink-0 text-orange-500" aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-bold text-orange-700 dark:text-orange-300">
            {overview?.streak ?? 0} {t.dashboard.streakDaysShort}
          </div>
          <div className="text-xs leading-snug text-orange-800/80 dark:text-orange-200/70">
            {t.dashboard.streakHint}
          </div>
        </div>
      </div>

      {/* Account (login / profile+logout) — sits with the language + theme
          controls in the bottom-left corner. */}
      <SidebarAccount onOpenProfile={onOpenProfile} disabled={disabled} />

      {/* Prefs */}
      <PrefsControls />
    </div>
  )
}
