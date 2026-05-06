"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

import { useTranslations } from "@/lib/i18n"
import { formatDurationMs } from "@/lib/metele/format"
import type { GameResult } from "@/lib/metele/types"

type Props = {
  open: boolean
  result: GameResult | null
  onClose: () => void
}

export function ResultsModal({ open, result, onClose }: Props) {
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
          <DialogTitle className="text-2xl">{t.results.title}</DialogTitle>
          <DialogDescription>
            {result ? reasonText(result.reason, t) : ""}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label={t.results.duration} value={formatDurationMs(result.durationMs)} />
              <Stat label={t.results.characters} value={result.characters.toString()} />
              <Stat label={t.results.words} value={result.words.toString()} />
              <Stat
                label={t.results.requiredWordsUsed}
                value={result.requiredWordsUsed.toString()}
              />
            </div>
            <DialogFooter>
              <Button onClick={onClose}>{t.results.close}</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
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
