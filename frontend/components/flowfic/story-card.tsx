"use client"

import { useState } from "react"
import { MoreHorizontal, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "@/lib/i18n"
import { deriveTitle, formatCount, storyVisual } from "@/lib/flowfic/gamification"
import type { Story } from "@/lib/flowfic/stories-api"

import { IconChip } from "./dashboard-widgets"

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key]
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

// "Today" / "Yesterday" / "N days ago" for recent stories, absolute date beyond
// a week. Uses local calendar days.
function relativeDay(iso: string, t: ReturnType<typeof useTranslations>, locale: string): string {
  const then = new Date(iso)
  const now = new Date()
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((startNow.getTime() - startThen.getTime()) / 86_400_000)
  if (days <= 0) return t.dashboard.today
  if (days === 1) return t.dashboard.yesterday
  if (days < 7) return t.dashboard.daysAgo.replace("{n}", String(days))
  return then.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    day: "numeric",
    month: "short",
  })
}

type Props = {
  story: Story
  onSelect?: (story: Story) => void
  onDelete?: (id: number) => Promise<boolean>
}

export function StoryCard({ story, onSelect, onDelete }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const { icon, tone } = storyVisual(story.id)
  const title = story.title?.trim() || deriveTitle(story.text, t.dashboard.untitledStory)
  const words = readNumber(story.stats, "words")
  const meta = `${formatCount(words, locale)} ${t.dashboard.words} · ${relativeDay(story.createdAt, t, locale)}`

  async function handleConfirm() {
    if (!onDelete) return
    setBusy(true)
    setError(false)
    const ok = await onDelete(story.id)
    setBusy(false)
    if (!ok) {
      setError(true)
      return
    }
    setConfirmOpen(false)
  }

  return (
    <div className="group bg-card relative rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <button
        type="button"
        onClick={onSelect ? () => onSelect(story) : undefined}
        className={cn(
          "focus-visible:ring-ring/50 flex w-full flex-col gap-2 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none",
          onSelect && "cursor-pointer",
        )}
        aria-label={`${title} — ${meta}`}
      >
        <IconChip icon={icon} tone={tone} className="size-11" />
        <div className="truncate pr-6 text-sm font-bold">{title}</div>
        <div className="text-muted-foreground text-xs">{meta}</div>
      </button>

      {onDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t.sidebar.rowMenuLabel}
              className="absolute top-2 right-2 size-7"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault()
                setError(false)
                setConfirmOpen(true)
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              {t.sidebar.deleteStory}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.sidebar.deleteStoryConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.sidebar.deleteStoryConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {t.sidebar.deleteStoryFailed}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t.sidebar.deleteStoryCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleConfirm()
              }}
              disabled={busy}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {t.sidebar.deleteStoryConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
