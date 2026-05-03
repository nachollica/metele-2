"use client"

import { useState } from "react"
import { Gauge, PenLine, Sparkles, Eraser, Share2, Play } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

import { useTranslations } from "@/lib/i18n"

type Props = {
  open: boolean
  onContinue: (dontShowAgain: boolean) => void
}

export function WelcomeModal({ open, onContinue }: Props) {
  const t = useTranslations()
  const [dontShow, setDontShow] = useState(false)

  const items = [
    { icon: Gauge, ...t.welcome.items.pickVelocity },
    { icon: PenLine, ...t.welcome.items.createStory },
    { icon: Sparkles, ...t.welcome.items.requiredWords },
    { icon: Eraser, ...t.welcome.items.noMistakes },
    { icon: Share2, ...t.welcome.items.shareSave },
  ]

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t.welcome.title}</DialogTitle>
          <DialogDescription>{t.welcome.description}</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-4">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-serif text-base font-semibold">{title}</span>
                <span className="text-muted-foreground text-sm leading-snug">{body}</span>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="welcome-dont-show"
              checked={dontShow}
              onCheckedChange={(v) => setDontShow(v === true)}
            />
            <Label htmlFor="welcome-dont-show" className="text-sm font-normal">
              {t.welcome.dontShowAgain}
            </Label>
          </div>
          <Button onClick={() => onContinue(dontShow)} className="w-full sm:w-auto">
            <Play className="size-4" aria-hidden />
            {t.welcome.start}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
