"use client"

import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "@/lib/i18n"
import { DAILY_PROMPTS } from "@/lib/flowfic/prompts"
import { dailyPromptIndex } from "@/lib/flowfic/gamification"

import { Panel, SectionHeader } from "./dashboard-widgets"

// Placeholder inspiration image. The real feature (movie stills chosen per
// session) comes later; for now we show a stable landscape placeholder so the
// layout is real. A fixed seed keeps the same image across renders instead of
// flickering to a new one on every mount.
const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/flowfic/1280/720"

/** Landscape (16:9) inspiration image. Decorative placeholder for now. */
export function InspirationImage({ className }: { className?: string }) {
  const t = useTranslations()
  return (
    <div
      className={cn(
        "bg-muted aspect-video w-full overflow-hidden rounded-2xl border shadow-sm",
        className,
      )}
    >
      {/* Plain <img>: the app is a static export. Real image logic lands later. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PLACEHOLDER_IMAGE}
        alt={t.dashboard.inspirationAlt}
        className="size-full object-cover"
      />
    </div>
  )
}

/** Prompt-of-the-day card. */
export function PromptOfDay({ className }: { className?: string }) {
  const t = useTranslations()
  const locale = useLocale()
  const prompt = DAILY_PROMPTS[locale][dailyPromptIndex(DAILY_PROMPTS[locale].length)]

  return (
    <Panel className={cn("flex flex-col", className)}>
      <SectionHeader title={t.dashboard.promptOfDay} />
      <p className="text-foreground/80 flex-1 text-lg leading-snug font-medium italic">
        &ldquo;{prompt}&rdquo;
      </p>
    </Panel>
  )
}

/**
 * Inspiration column shown on the right half of the desktop split while the
 * user configures or plays a session: the placeholder image on top, the daily
 * prompt beneath it. Hidden on mobile by the caller (space is too tight to keep
 * it visible during play).
 */
export function InspirationPanel({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <InspirationImage />
      <PromptOfDay />
    </div>
  )
}
