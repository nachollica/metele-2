"use client"

import { useMemo, type ChangeEvent, type KeyboardEvent, type Ref } from "react"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import type { MatchedRange } from "@/lib/metele/types"

type Props = {
  ref?: Ref<HTMLTextAreaElement>
  value: string
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  matches: MatchedRange[]
  disabled?: boolean
}

// Shared typography classes for the textarea and the backdrop. They MUST match
// exactly so highlight rectangles align with the rendered text.
const SHARED_TEXT_CLASSES = cn(
  "font-serif text-lg leading-relaxed sm:text-xl",
  "p-6 sm:p-8",
  "whitespace-pre-wrap break-words",
)

/**
 * Textarea where the user writes their story. A backdrop div sits behind the
 * textarea and renders the same text with highlighted spans for previously
 * matched required words. The wrapper holds the card background so both
 * layers can stay transparent and overlap correctly.
 *
 * Text is append-only: no backspace, no editing, no cursor movement except
 * to the end. Selection is allowed but cannot be deleted/replaced.
 */
export function WritingArea({ ref, value, onChange, matches, disabled }: Props) {
  const t = useTranslations()

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return

    const textarea = e.currentTarget
    const selectionStart = textarea.selectionStart ?? 0
    const selectionEnd = textarea.selectionEnd ?? 0
    const isSelection = selectionStart !== selectionEnd

    // Block: Backspace, Delete, Home, End, Page Up/Down, arrow keys
    // (arrow keys can move the cursor away from the end)
    if (
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "Home" ||
      e.key === "End" ||
      e.key === "PageUp" ||
      e.key === "PageDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowDown"
    ) {
      e.preventDefault()
      return
    }

    // Block: Cut, Undo, Redo, Select All if it would select non-end content
    const isCmd = e.ctrlKey || e.metaKey
    const isEditShortcut =
      isCmd &&
      (e.key === "x" ||
        e.key === "z" ||
        e.key === "y" ||
        (e.key === "a" && selectionStart === 0 && selectionEnd < value.length))
    if (isEditShortcut) {
      e.preventDefault()
      return
    }

    // Allow typing only at the end of the text. If there's a selection, reject.
    if (isSelection) {
      e.preventDefault()
      return
    }

    // If the cursor is not at the end, and the key is a printable character, reject.
    if (
      selectionEnd < value.length &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault()
      return
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value

    // Enforce append-only: if the new text is shorter or a middle section changed,
    // reject the change. We do this defensively to catch any edit that slipped through.
    if (next.length < value.length) {
      // Backspace or deletion snuck through; reject by not calling onChange.
      e.target.value = value
      return
    }

    // Check if any character before the end changed (edit in the middle).
    if (next.length > value.length) {
      // Character(s) were added. They must all be appended to the end.
      const oldLen = value.length
      for (let i = 0; i < oldLen; i++) {
        if (next[i] !== value[i]) {
          // Middle edit detected.
          e.target.value = value
          return
        }
      }
    }

    onChange(e)
  }

  // Pre-compute text segments split by match ranges so we don't redo this
  // on every render past what's necessary.
  const segments = useMemo(() => {
    if (matches.length === 0) return [{ text: value, highlight: false }]

    // Sort & merge overlapping ranges defensively.
    const sorted = [...matches].sort((a, b) => a.start - b.start)
    const out: { text: string; highlight: boolean }[] = []
    let cursor = 0
    for (const m of sorted) {
      if (m.start > cursor) {
        out.push({ text: value.slice(cursor, m.start), highlight: false })
      }
      out.push({ text: value.slice(m.start, m.end), highlight: true })
      cursor = m.end
    }
    if (cursor < value.length) {
      out.push({ text: value.slice(cursor), highlight: false })
    }
    return out
  }, [value, matches])

  return (
    <div className="bg-card focus-within:ring-ring/40 relative h-full w-full overflow-hidden rounded-lg border shadow-sm transition-shadow focus-within:ring-4">
      {/* Highlight backdrop — same typography as the textarea, behind it. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden",
          SHARED_TEXT_CLASSES,
          "text-transparent",
        )}
      >
        {segments.map((seg, i) =>
          seg.highlight ? (
            <mark
              key={i}
              // Background paints the highlight; text stays transparent
              // because the real visible text comes from the textarea above.
              className="bg-highlight rounded-sm text-transparent"
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
        {/* Trailing newline so the backdrop matches the textarea height when
            the user is on a fresh line. */}
        {"\n"}
      </div>

      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        spellCheck={false}
        autoFocus
        placeholder={t.game.placeholder}
        className={cn(
          "text-card-foreground placeholder:text-muted-foreground/60 relative h-full w-full resize-none bg-transparent outline-none",
          SHARED_TEXT_CLASSES,
          "selection:bg-primary/20",
        )}
        aria-label={t.game.placeholder}
      />
    </div>
  )
}
