"use client"

import { useState, type KeyboardEvent } from "react"
import { Check, MoreHorizontal, Pencil, Trash2, X } from "lucide-react"

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
import { Input } from "@/components/ui/input"

import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "@/lib/i18n"
import { formatStoryDate } from "@/lib/flowfic/format"
import { deriveTitle, formatCount, storyVisual } from "@/lib/flowfic/gamification"
import type { Story } from "@/lib/flowfic/stories-api"
import { FIELD_LABEL, HINT, ITEM_TITLE, MICRO } from "@/lib/text-styles"

import { IconChip, panelVariants } from "./dashboard-widgets"

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key]
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

type Props = {
  story: Story
  onSelect?: (story: Story) => void
  onDelete?: (id: number) => Promise<boolean>
  /** Rename handler (title only; null clears back to the derived title). */
  onUpdateTitle?: (id: number, title: string | null) => Promise<boolean>
  /** Stretch to the height of the parent row (the landing's fixed-height
   *  preview panel divides its space into equal rows). */
  fill?: boolean
}

/**
 * One story as a full-width row: cover icon, title, a two-line text preview,
 * and a words + date meta line. The overflow menu offers Rename (inline
 * editing) and Delete when the respective handlers are provided.
 */
export function StoryCard({ story, onSelect, onDelete, onUpdateTitle, fill = false }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState("")
  const [renameBusy, setRenameBusy] = useState(false)

  const { icon, tone } = storyVisual(story.id)
  const title = story.title?.trim() || deriveTitle(story.text, t.dashboard.untitledStory)
  const words = readNumber(story.stats, "words")
  const meta = `${formatCount(words, locale)} ${t.dashboard.words} · ${formatStoryDate(
    story.createdAt,
    locale,
    t.dashboard.today,
  )}`

  const hasMenu = Boolean(onDelete || onUpdateTitle)

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

  function startRename() {
    setDraft(story.title ?? "")
    setRenaming(true)
  }

  async function submitRename() {
    if (!onUpdateTitle) return
    const next = draft.trim()
    setRenameBusy(true)
    const ok = await onUpdateTitle(story.id, next.length > 0 ? next : null)
    setRenameBusy(false)
    if (ok) setRenaming(false)
  }

  function onRenameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void submitRename()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setRenaming(false)
    }
  }

  return (
    <div
      className={cn(
        panelVariants({ padding: "sm" }),
        "group relative flex gap-4 overflow-hidden transition hover:shadow-md",
        fill && "h-full",
      )}
    >
      <IconChip icon={icon} tone={tone} className="size-12 shrink-0" />

      <div className="min-w-0 flex-1">
        {renaming ? (
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onRenameKey}
              maxLength={200}
              placeholder={title}
              aria-label={t.sidebar.renameStoryLabel}
              className={cn("h-8", FIELD_LABEL)}
              disabled={renameBusy}
            />
            <button
              type="button"
              onClick={() => void submitRename()}
              aria-label={t.sidebar.renameSave}
              disabled={renameBusy}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex size-7 shrink-0 items-center justify-center rounded-md disabled:opacity-50"
            >
              <Check className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              aria-label={t.sidebar.renameCancel}
              disabled={renameBusy}
              className="hover:bg-accent text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSelect ? () => onSelect(story) : undefined}
            className={cn(
              "focus-visible:ring-ring/50 block w-full rounded-md text-left focus-visible:ring-2 focus-visible:outline-none",
              onSelect && "cursor-pointer",
            )}
            aria-label={`${title} — ${meta}`}
          >
            <div className={cn(ITEM_TITLE, "truncate pr-8")}>{title}</div>
            {/* Filling a fixed row leaves less vertical room than a naturally
                sized card, so the preview drops to a single line there. */}
            <p
              className={cn(
                HINT,
                "mt-1 leading-relaxed",
                fill ? "line-clamp-1" : "line-clamp-2",
              )}
            >
              {story.text}
            </p>
            <div className={cn(MICRO, "mt-2")}>{meta}</div>
          </button>
        )}
      </div>

      {hasMenu && !renaming ? (
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
            {onUpdateTitle ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  startRename()
                }}
              >
                <Pencil className="size-4" aria-hidden />
                {t.sidebar.renameStory}
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
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
            ) : null}
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
