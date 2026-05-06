"use client"

import { useEffect, useState } from "react"
import { Calendar, Clock, History } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { useTranslations } from "@/lib/i18n"
import { fetchStories, type Story } from "@/lib/metele/stories-api"

// First-character preview cap. Long stories show the head + ellipsis so the
// sidebar list rows stay one consistent height.
const PREVIEW_CHARS = 90

// Pull this many stories at a time. The sidebar is meant to scroll inside its
// own viewport — anything beyond this is rare and can be a follow-up.
const PAGE_SIZE = 50

type Props = {
  /** Bumped by the parent after a successful POST so the list refetches. */
  refreshKey?: number
  /** Click handler for a story row. Optional — wired for future story view. */
  onSelect?: (story: Story) => void
}

export function StoriesSidebar({ refreshKey = 0, onSelect }: Props) {
  const t = useTranslations()
  const [items, setItems] = useState<Story[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(false)
    fetchStories({ limit: PAGE_SIZE, offset: 0 }).then((res) => {
      if (cancelled) return
      if (res === null) {
        setError(true)
        setItems([])
        return
      }
      setItems(res.items)
    })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b p-4">
        <div className="flex items-center gap-2">
          <History className="text-muted-foreground size-4" aria-hidden />
          <h2 className="font-serif text-base font-semibold tracking-tight">
            {t.sidebar.title}
          </h2>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{t.sidebar.subtitle}</p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col gap-1 p-2" aria-label={t.sidebar.title}>
          {items === null ? (
            <SkeletonRows />
          ) : items.length === 0 ? (
            <li className="text-muted-foreground p-4 text-center text-xs">
              {error ? t.sidebar.error : t.sidebar.empty}
            </li>
          ) : (
            items.map((story) => (
              <StoryRow key={story.id} story={story} onSelect={onSelect} />
            ))
          )}
        </ul>
      </ScrollArea>
    </div>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="px-2 py-3">
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-1 h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </li>
      ))}
    </>
  )
}

type RowProps = {
  story: Story
  onSelect?: (story: Story) => void
}

function StoryRow({ story, onSelect }: RowProps) {
  const t = useTranslations()
  const preview = makePreview(story.text)
  const created = new Date(story.createdAt)
  const dateLabel = formatDate(created)
  // Pull duration out of the JSON stats blob — written there by the
  // frontend's `GameResult` payload at end of session.
  const durationMs = readNumber(story.stats, "durationMs")
  const durationLabel = durationMs !== null ? formatDuration(durationMs) : null

  const interactive = onSelect !== undefined
  const Tag = interactive ? "button" : "div"

  return (
    <li>
      <Tag
        type={interactive ? "button" : undefined}
        onClick={interactive ? () => onSelect!(story) : undefined}
        aria-label={`${preview} — ${dateLabel}${durationLabel ? `, ${durationLabel}` : ""}`}
        className={cn(
          "hover:bg-accent/25 focus-visible:bg-accent/25 focus-visible:ring-ring/50 flex w-full flex-col gap-1.5 rounded-md p-2 text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
          interactive && "cursor-pointer",
        )}
      >
        {/* `break-all` lets the row truncate mid-word so an extra-long token
            (URL, no-space gibberish) can't push the row wider than the
            sidebar. Combined with `line-clamp-2`, the visible amount adapts
            to the row width: wider sidebar → more chars per line. */}
        <p className="line-clamp-2 text-sm leading-snug break-all">{preview}</p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3" aria-hidden />
            <span>{dateLabel}</span>
          </span>
          {durationLabel ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              <span>{durationLabel}</span>
              <span className="sr-only">{t.sidebar.durationLabel}</span>
            </span>
          ) : null}
        </div>
      </Tag>
    </li>
  )
}

function makePreview(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim()
  if (collapsed.length <= PREVIEW_CHARS) return collapsed
  return collapsed.slice(0, PREVIEW_CHARS).trimEnd() + "…"
}

// Best-effort short date+time. Uses the browser's locale rather than the
// in-app i18n locale so timezones and 12/24h display match the user's OS
// preferences — sidebar metadata is not gameplay-critical.
function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function readNumber(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key]
  return typeof v === "number" && Number.isFinite(v) ? v : null
}
