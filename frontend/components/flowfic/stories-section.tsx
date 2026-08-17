"use client"

import { Fragment, useMemo, useState } from "react"
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
import { formatCount } from "@/lib/flowfic/gamification"
import { filterAndSortStories, type SortOrder } from "@/lib/flowfic/story-search"

import { EmptyHint, Panel, SectionHeader, ShowAllButton } from "./dashboard-widgets"
import { StoryCard } from "./story-card"

// How many stories the landing preview shows before "Show all". The showcase
// pane divides its fixed height into exactly this many rows, so the number is a
// layout decision as much as a content one — raising it shrinks every row.
// Four lands each row near a StoryCard's natural height in the 3:2 pane; five
// fitted the taller 4:3 box this replaced.
const PREVIEW_COUNT = 4

type Props = {
  stories: Story[] | null
  error: boolean
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
  onUpdateTitle: (id: number, title: string | null) => Promise<boolean>
  /** Render a trimmed card for the landing dashboard instead of the full screen. */
  preview?: boolean
  /** Drop the preview's own card chrome — the showcase pane already supplies it. */
  flush?: boolean
  /** Open the expanded My-stories screen (preview only). */
  onShowAll?: () => void
  /** How many the account has in total — more than `stories.length` until every
   *  page is loaded. Full screen only; heads the list. */
  total?: number | null
  /** Whether another page is waiting behind the loaded ones (full screen). */
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
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
  flush = false,
  onShowAll,
  total = null,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
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
    // Flush drops the card chrome (the showcase pane already supplies it) and,
    // with it, the wrapper element — so the preview's own flex column is the
    // direct child of that fixed-shape pane and can fill it.
    const Wrapper = flush ? Fragment : Panel
    return (
      <Wrapper>
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
        {/* Exactly PREVIEW_COUNT rows, each taking an equal share of the
            panel's fixed height — nothing scrolls. With fewer stories the rows
            keep their share and the remainder is simply left empty, rather
            than stretching one card over the whole box. */}
        {stories === null ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {Array.from({ length: PREVIEW_COUNT }).map((_, i) => (
              <Skeleton key={i} className="min-h-0 flex-1 rounded-2xl" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyHint className="py-6">
            {error
              ? t.sidebar.error
              : status === "anonymous"
                ? t.sidebar.signUpPrompt
                : t.dashboard.emptyStories}
          </EmptyHint>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {recent.map((s) => (
              <div key={s.id} className="min-h-0 flex-1">
                <StoryCard
                  story={s}
                  onSelect={onViewStory}
                  onDelete={onDeleteStory}
                  onUpdateTitle={onUpdateTitle}
                  fill
                />
              </div>
            ))}
            {/* Reserve the unused rows so three stories and one story lay the
                panel out identically. */}
            {Array.from({ length: PREVIEW_COUNT - recent.length }).map((_, i) => (
              <div key={`spacer-${i}`} aria-hidden className="min-h-0 flex-1" />
            ))}
          </div>
        )}
      </Wrapper>
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
      <EmptyHint>
        {error
          ? t.sidebar.error
          : status === "anonymous"
            ? t.sidebar.signUpPrompt
            : t.dashboard.emptyStories}
      </EmptyHint>
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

      {/* How many the account holds — the one place this count lives now that
          the profile screen no longer carries it. While a filter is active it
          reports the matches instead, since that is what the list is showing. */}
      <p className="text-muted-foreground text-sm" role="status">
        {hasFilters
          ? t.sidebar.resultCount.replace("{count}", formatCount(results.length, locale))
          : t.sidebar.storyCount.replace(
              "{count}",
              formatCount(total ?? stories.length, locale),
            )}
      </p>

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
        <EmptyHint>{hasFilters ? t.sidebar.noResults : t.dashboard.emptyStories}</EmptyHint>
      )}

      {/* The list loads a page at a time. Hidden while a filter is active,
          because search runs over the loaded set only — offering "more" there
          would suggest it were searching the whole library. */}
      {hasMore && !hasFilters ? (
        <div className="flex justify-center pt-2">
          <Button type="button" variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? t.sidebar.loadingMore : t.sidebar.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
