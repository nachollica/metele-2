"use client"

import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLocale, useTranslations } from "@/lib/i18n"
import { deriveTitle, formatCount } from "@/lib/flowfic/gamification"
import { formatStoryDate } from "@/lib/flowfic/format"
import type { PendingStory } from "@/lib/flowfic/pending-story"
import { HINT } from "@/lib/text-styles"

import { DiscardStoryStep } from "./discard-story-step"

/**
 * Offered when someone signs in and a story is still sitting in storage that
 * they never asked us to keep — they finished it anonymously, wandered off,
 * and signed in later for some other reason.
 *
 * The whole point is that it asks. Saving such a draft automatically is what
 * would let a story someone had already forgotten about reappear days later,
 * so the modal names what it found — title, length, and when it was written —
 * instead of assuming the story is still wanted.
 */
export function RecoverStoryModal({
  pending,
  onSave,
  onDiscard,
  onOpenChange,
}: {
  /** The draft to offer, or null to stay closed. */
  pending: PendingStory | null
  /** Saves it; resolves false if the request failed, leaving the modal up. */
  onSave: () => Promise<boolean>
  onDiscard: () => void
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations()
  const locale = useLocale()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  if (pending === null) return null

  const { payload, savedAt } = pending
  const title = payload.title ?? deriveTitle(payload.text, t.dashboard.untitledStory)
  const words = typeof payload.stats.words === "number" ? payload.stats.words : 0
  const meta = t.saveStory.recoverMeta
    .replace("{title}", title)
    .replace("{words}", formatCount(words, locale))
    .replace("{date}", formatStoryDate(new Date(savedAt).toISOString(), locale, t.dashboard.today))

  async function handleSave() {
    setSaving(true)
    setFailed(false)
    const ok = await onSave()
    setSaving(false)
    // On failure the draft is still stored, so leaving the modal up keeps the
    // only control that can retry within reach.
    if (!ok) setFailed(true)
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Backing out of the confirmation returns to the offer, not out of it.
        if (!next && confirmingDiscard) {
          setConfirmingDiscard(false)
          return
        }
        if (!next) setConfirmingDiscard(false)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        {confirmingDiscard ? (
          <DiscardStoryStep
            onCancel={() => setConfirmingDiscard(false)}
            onConfirm={() => {
              setConfirmingDiscard(false)
              onDiscard()
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t.saveStory.recoverTitle}</DialogTitle>
              <DialogDescription>{t.saveStory.recoverDescription}</DialogDescription>
            </DialogHeader>

            <p className="text-foreground text-sm font-medium">{meta}</p>
            {failed ? (
              <p role="alert" className="text-destructive text-sm">
                {t.saveStory.recoverFailed}
              </p>
            ) : (
              <p className={HINT}>{payload.text.slice(0, 160)}…</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmingDiscard(true)}
                disabled={saving}
              >
                {t.saveStory.recoverDiscard}
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? t.saveStory.recoverSaving : t.saveStory.recoverSave}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
