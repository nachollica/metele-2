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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

import { useTranslations } from "@/lib/i18n"
import type { GameResult } from "@/lib/metele/types"

type Props = {
  open: boolean
  result: GameResult | null
  onPlayAgain: () => void
}

export function ResultsModal({ open, result, onPlayAgain }: Props) {
  const t = useTranslations()
  const [copied, setCopied] = useState(false)

  if (!result) return null

  const reasonText =
    result.reason === "idle"
      ? t.results.reasonIdle
      : result.reason === "global"
        ? t.results.reasonGlobal
        : result.reason === "unused-word"
          ? t.results.reasonUnusedWord
          : t.results.reasonManual

  async function handleCopy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be unavailable; silently ignore.
    }
  }

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
          <DialogDescription>{reasonText}</DialogDescription>
        </DialogHeader>

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
          <ScrollArea className="bg-muted/40 h-48 rounded-md border">
            <p className="font-serif p-4 text-base leading-relaxed whitespace-pre-wrap">
              {result.text || "—"}
            </p>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCopy} disabled={!result.text}>
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
      </DialogContent>
    </Dialog>
  )
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
