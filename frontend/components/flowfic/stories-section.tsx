"use client"

import { Skeleton } from "@/components/ui/skeleton"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import type { Story } from "@/lib/flowfic/stories-api"

import { StoryCard } from "./story-card"

type Props = {
  stories: Story[] | null
  error: boolean
  onViewStory: (story: Story) => void
  onDeleteStory: (id: number) => Promise<boolean>
}

export function StoriesSection({ stories, error, onViewStory, onDeleteStory }: Props) {
  const t = useTranslations()
  const { status } = useAuth()

  if (stories === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    )
  }

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

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stories.map((s) => (
        <StoryCard key={s.id} story={s} onSelect={onViewStory} onDelete={onDeleteStory} />
      ))}
    </div>
  )
}
