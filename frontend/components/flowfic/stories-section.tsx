"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  CalendarDays,
  Search,
} from "lucide-react"
import { enUS, es } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"

import { useAuth } from "@/lib/auth"
import { useLocale, useTranslations } from "@/lib/i18n"
import type { Story } from "@/lib/flowfic/stories-api"
import { filterAndSortStories, type SortOrder } from "@/lib/flowfic/story-search"

import { Panel, SectionHeader, ShowAllButton } from "./dashboard-widgets"
import { StoryCard } from "./story-card"

// How many stories the landing preview card shows before "Show all".
const PREVIEW_COUNT = 3

type Props = {
  stories: Story[] | null
  error: boolean
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateTitle: (id: number, title: string | null) => Promise<boolean>
  /** Render a trimmed card for the landing dashboard instead of the full screen. */
  preview?: boolean
  /** Open the expanded My-stories screen (preview only). */
  onShowAll?: () => void
}

function fmtDay(d: Date, locale: string): string {
  return d.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function StoriesSection({
  stories,
  error,
  onViewStory,
  onDeleteStory,
  onUpdateTitle,
  preview = false,
  onShowAll,
}: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const { status } = useAuth()

  const [query, setQuery] = useState("")
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [sort, setSort] = useState<SortOrder>("newest")

  const filtered = useMemo(() => {
    if (!stories) return null
    return filterAndSortStories(stories, {
      query,
      from: range?.from ?? null,
      to: range?.to ?? null,
      sort,
    })
  }, [stories, query, range, sort])

  // ---- Preview card (landing) ---------------------------------------------
  if (preview) {
    const recent = stories
      ? filterAndSortStories(stories, { query: "", from: null, to: null, sort: "newest" }).slice(
          0,
          PREVIEW_COUNT,
        )
      : []
    return (
      <Panel>
        <SectionHeader
          title={t.dashboard.recentStories}
          action={
            onShowAll ? (
              <ShowAllButton
                label={t.nav.showAll}
                sectionName={t.nav.stories}
                onClick={onShowAll}
                disabled={status === "anonymous"}
              />
            ) : null
          }
        />
        {stories === null ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {error
              ? t.sidebar.error
              : status === "anonymous"
                ? t.sidebar.signUpPrompt
                : t.dashboard.emptyStories}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {recent.map((s) => (
              <StoryCard
                key={s.id}
                story={s}
                onSelect={onViewStory}
                onDelete={onDeleteStory}
                onUpdateTitle={onUpdateTitle}
              />
            ))}
          </div>
        )}
      </Panel>
    )
  }

  // ---- Full screen --------------------------------------------------------
  // First load.
  if (stories === null) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    )
  }

  // No stories at all — the search bar would have nothing to act on.
  if (stories.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        {error
          ? t.sidebar.error
          : status === "anonymous"
            ? t.sidebar.signUpPrompt
            : t.dashboard.emptyStories}
      </p>
    )
  }

  const dateLabel = range?.from
    ? range.to
      ? `${fmtDay(range.from, locale)} – ${fmtDay(range.to, locale)}`
      : fmtDay(range.from, locale)
    : t.sidebar.filterByDate

  const hasFilters = query.trim().length > 0 || Boolean(range?.from)
  const results = filtered ?? []

  return (
    <div className="flex flex-col gap-4">
      {/* Search + date filter + sort */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.sidebar.searchPlaceholder}
            aria-label={t.sidebar.searchPlaceholder}
            className="pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start gap-2">
              <CalendarDays className="size-4" aria-hidden />
              {dateLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              locale={locale === "es" ? es : enUS}
              numberOfMonths={1}
              autoFocus
            />
            <div className="flex justify-end border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRange(undefined)}
                disabled={!range?.from}
              >
                {t.sidebar.filterClear}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
          className="gap-2"
          aria-label={t.sidebar.sortLabel}
        >
          {sort === "newest" ? (
            <ArrowDownWideNarrow className="size-4" aria-hidden />
          ) : (
            <ArrowUpWideNarrow className="size-4" aria-hidden />
          )}
          {sort === "newest" ? t.sidebar.sortNewest : t.sidebar.sortOldest}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className="flex flex-col gap-3">
          {results.map((s) => (
            <StoryCard
              key={s.id}
              story={s}
              onSelect={onViewStory}
              onDelete={onDeleteStory}
              onUpdateTitle={onUpdateTitle}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground py-12 text-center text-sm">
          {hasFilters ? t.sidebar.noResults : t.dashboard.emptyStories}
        </p>
      )}
    </div>
  )
}
