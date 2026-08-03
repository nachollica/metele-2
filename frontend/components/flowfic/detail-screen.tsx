"use client"

import { type ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n"

type Props = {
  /** Screen title shown next to the back arrow. */
  title: ReactNode
  /** Return to the previous screen (usually the landing dashboard). */
  onBack: () => void
  /**
   * Accessible name for the back arrow. Defaults to "Back to home"; a screen
   * whose arrow returns elsewhere (e.g. a story returning to the stories list)
   * passes its own label so the name matches the destination.
   */
  backLabel?: string
  children: ReactNode
}

/**
 * Chrome for an "expanded subsection" reached from a landing "Show all" link
 * (Statistics, Achievements, Challenges, My stories, Profile, a single story).
 * The removed sidebar no longer marks the active section, so each detail screen
 * carries its own back arrow + title at the top of the main area.
 */
export function DetailScreen({ title, onBack, backLabel, children }: Props) {
  const t = useTranslations()
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label={backLabel ?? t.nav.backToHome}
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      {children}
    </div>
  )
}
