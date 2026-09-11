"use client"

import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n"

/**
 * "The story could not be saved" — with the one control that can do something
 * about it.
 *
 * This used to live inside `GameArea`, which mounts only while a sprint is
 * loading, playing, or in its epilogue. The save fires from `finishAndReset`,
 * which sets the session back to `idle` in the same tick, so on the main exit
 * the alert was raised into a tree that had already unmounted and nobody ever
 * saw it — the failure was silent. On the one path where the game area *did*
 * stay mounted (starting another sprint straight away) it turned up over a
 * brand-new empty sprint, attached to the wrong story. It belongs to the app,
 * not to the game screen, so the shell renders it in both layouts.
 *
 * It now only ever means a request that was made and failed. A player with no
 * account never reaches the save path at all — they are offered a sign-in
 * instead, which is a thing they can act on, unlike a Retry that could never
 * succeed without a token.
 */
export function SaveFailureAlert({
  retrying,
  onRetry,
  onDismiss,
}: {
  retrying: boolean
  onRetry: () => void
  onDismiss: () => void
}) {
  const t = useTranslations()
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3 text-sm"
    >
      <AlertTriangle className="text-destructive size-4 shrink-0" aria-hidden />
      <span className="text-destructive flex-1">{t.game.saveFailed}</span>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? t.game.saveRetrying : t.game.saveRetry}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss} disabled={retrying}>
          {t.game.saveDismiss}
        </Button>
      </div>
    </div>
  )
}
