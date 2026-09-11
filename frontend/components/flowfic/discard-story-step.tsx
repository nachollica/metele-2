"use client"

import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n"

/**
 * Second step of "throw this story away", shared by the sign-in prompt and the
 * recovery modal.
 *
 * It is a *step inside* an open dialog rather than an AlertDialog stacked on
 * top of one, and that is deliberate. Nesting two Radix modals means two
 * `react-remove-scroll` instances both writing `body[data-scroll-locked]` —
 * the same scrollbar-compensation machinery the app already had to neutralise
 * with a higher-specificity rule in `globals.css`. One overlay, one focus trap,
 * one scroll lock keeps that whole class of bug out of reach.
 *
 * Swapping the title and description (rather than only the buttons) is what
 * makes the confirmation reach assistive tech: the dialog announces its new
 * name, so the step is not a silent change of what the buttons do.
 */
export function DiscardStoryStep({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useTranslations()
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.saveStory.confirmTitle}</DialogTitle>
        <DialogDescription>{t.saveStory.confirmDescription}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        {/* Focus lands on the way back, not on the irreversible button. */}
        <Button type="button" variant="outline" onClick={onCancel} autoFocus>
          {t.saveStory.confirmCancel}
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm}>
          {t.saveStory.confirmDiscard}
        </Button>
      </DialogFooter>
    </>
  )
}
