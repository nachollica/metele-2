"use client"

import { useState } from "react"
import { Copy, RotateCcw, Check } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import type { GameResult } from "@/lib/metele/types"

type Props = {
  open: boolean
  result: GameResult | null
  onPlayAgain: () => void
}

export function ResultsModal({ open, result, onPlayAgain }: Props) {
  const t = useTranslations()

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t.results.title}</DialogTitle>
          <DialogDescription>
            {result ? reasonText(result.reason, t) : ""}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          // Re-mount on every new result so the editable buffer resets cleanly
          // without a useEffect-driven sync.
          <ResultsBody key={result.durationMs} result={result} onPlayAgain={onPlayAgain} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ResultsBody({
  result,
  onPlayAgain,
}: {
  result: GameResult
  onPlayAgain: () => void
}) {
  const t = useTranslations()
  const [copied, setCopied] = useState(false)
  const [editedText, setEditedText] = useState(result.text)

  async function handleCopy() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(editedText)
      } else {
        // navigator.clipboard unavailable in non-secure contexts (HTTP on non-localhost).
        // execCommand is deprecated but works as fallback.
        const el = document.createElement("textarea")
        el.value = editedText
        el.style.position = "fixed"
        el.style.opacity = "0"
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand("copy")
        document.body.removeChild(el)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t.results.duration} value={formatDuration(result.durationMs)} />
        <Stat label={t.results.characters} value={result.characters.toString()} />
        <Stat label={t.results.words} value={result.words.toString()} />
        <Stat label={t.results.requiredWordsUsed} value={result.requiredWordsUsed.toString()} />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {t.results.yourStory}
        </h3>
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          spellCheck
          wrap="soft"
          aria-label={t.results.yourStory}
          className={cn(
            "bg-muted/40 h-48 w-full resize-none rounded-md border p-4",
            "font-serif text-base leading-relaxed",
            "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
            "focus-visible:ring-ring/40 outline-none focus-visible:ring-2",
          )}
        />
        <p className="text-muted-foreground text-xs">{t.results.editHint}</p>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={handleCopy} disabled={!editedText}>
          {copied ? (
            <>
              <Check className="size-4" aria-hidden />
              {t.results.copied}
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden />
              {t.results.copyStory}
            </>
          )}
        </Button>
        <Button onClick={onPlayAgain}>
          <RotateCcw className="size-4" aria-hidden />
          {t.results.playAgain}
        </Button>
      </DialogFooter>
    </>
  )
}

function reasonText(
  reason: GameResult["reason"],
  t: ReturnType<typeof useTranslations>,
): string {
  switch (reason) {
    case "idle":
      return t.results.reasonIdle
    case "global":
      return t.results.reasonGlobal
    case "unused-word":
      return t.results.reasonUnusedWord
    case "manual":
      return t.results.reasonManual
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 flex flex-col gap-1 rounded-md border p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}
