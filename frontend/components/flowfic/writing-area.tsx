"use client"

import { type ChangeEvent, type Ref } from "react"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import type { MatchedRange } from "@/lib/flowfic/types"

type Props = {
  ref?: Ref<HTMLTextAreaElement>
  value: string
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  // Kept in the API so the game can still report matched ranges (used by the
  // word-completion check). Currently unused by this component because the
  // visual highlight is disabled; if it comes back, this prop feeds it.
  matches: MatchedRange[]
  readOnly?: boolean
  /** Paused mid-sprint: the story stays fully legible, just greyed out and
   *  read-only so it is obvious nothing can be typed until it resumes. */
  paused?: boolean
}

// Shared typography classes for the textarea.
const SHARED_TEXT_CLASSES = cn(
  "font-serif text-lg leading-relaxed sm:text-xl",
  "p-6 sm:p-8",
  "whitespace-pre-wrap break-words",
)

/**
 * Textarea where the user writes their story.
 *
 * Editing rules: free-form editing (including deletion) is allowed. An
 * earlier iteration enforced append-only input and rendered a highlight
 * backdrop over matched required words; both were removed — recover them
 * from git history if ever needed.
 */
export function WritingArea({
  ref,
  value,
  onChange,
  matches: _matches,
  readOnly,
  paused = false,
}: Props) {
  const t = useTranslations()

  return (
    <div
      className={cn(
        "bg-card focus-within:ring-ring/40 relative h-full w-full overflow-hidden rounded-lg border shadow-sm transition-shadow focus-within:ring-4",
        paused && "bg-muted",
      )}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        readOnly={readOnly || paused}
        spellCheck={false}
        autoFocus={!readOnly}
        placeholder={t.game.placeholder}
        className={cn(
          "text-card-foreground placeholder:text-muted-foreground/60 relative h-full w-full resize-none bg-transparent outline-none",
          SHARED_TEXT_CLASSES,
          "selection:bg-highlight/25",
          paused && "text-muted-foreground cursor-default",
        )}
        aria-label={t.game.placeholder}
      />
    </div>
  )
}
