"use client"

import { useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  ListChecks,
  NotebookPen,
  WandSparkles,
  type LucideIcon,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

import { useTranslations } from "@/lib/i18n"
import { HINT, MICRO } from "@/lib/text-styles"

type Props = {
  open: boolean
  onContinue: (dontShowAgain: boolean) => void
}

export function WelcomeModal({ open, onContinue }: Props) {
  const t = useTranslations()
  const [dontShow, setDontShow] = useState(false)
  const [step, setStep] = useState(0)

  // The intro step shows the brand logo instead of a lucide glyph, so its
  // `icon` is omitted; every other step keeps its icon.
  const items: { icon?: LucideIcon; title: string; body: string }[] = [
    { ...t.welcome.items.intro },
    { icon: Gauge, ...t.welcome.items.pickVelocity },
    { icon: NotebookPen, ...t.welcome.items.createStory },
    { icon: WandSparkles, ...t.welcome.items.requiredWords },
    { icon: ListChecks, ...t.welcome.items.shareSave },
  ]

  const total = items.length
  const isFirst = step === 0
  const isLast = step === total - 1
  const current = items[step]
  const stepLabel = t.welcome.stepLabel
    .replace("{current}", String(step + 1))
    .replace("{total}", String(total))

  useEffect(() => {
    if (!open) {
      setStep(0)
      setDontShow(false)
    }
  }, [open])

  const goPrev = () => setStep((s) => Math.max(0, s - 1))
  const goNext = () => setStep((s) => Math.min(total - 1, s + 1))

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && !isFirst) {
      e.preventDefault()
      goPrev()
    } else if (e.key === "ArrowRight" && !isLast) {
      e.preventDefault()
      goNext()
    }
  }

  const showCheckbox = isFirst || isLast

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        // `bg-popover` (not the primitive's default `bg-background`) so the
        // modal is a raised surface distinct from the page — otherwise in dark
        // mode it paints the same color as the background and looks see-through.
        className="bg-popover sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">{t.welcome.items.intro.title}</DialogTitle>
        <DialogDescription className="sr-only">{t.welcome.items.intro.body}</DialogDescription>

        <div
          role="group"
          aria-label={stepLabel}
          aria-live="polite"
          className="flex flex-col items-center gap-5 px-2 pt-4 pb-2 text-center"
        >
          {current.icon ? (
            <current.icon
              className="text-primary size-32 sm:size-40"
              strokeWidth={1.25}
              aria-hidden
            />
          ) : (
            /* Intro step: brand mark sized to occupy the same box as the
               step icons. `object-contain` keeps the logo's aspect ratio
               within that square. Plain <img> — the app is a static export. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/flowfic-logo.png"
              alt=""
              aria-hidden
              className="size-32 object-contain sm:size-40"
            />
          )}
          <h3 className="font-serif text-2xl font-semibold">{current.title}</h3>
          <p className={cn(HINT, "max-w-sm leading-relaxed")}>{current.body}</p>
        </div>

        <div
          aria-hidden={!showCheckbox}
          className={cn(
            "flex h-7 items-center justify-center",
            !showCheckbox && "invisible",
          )}
        >
          <div className="flex items-center gap-2">
            <Checkbox
              id="welcome-dont-show"
              checked={dontShow}
              onCheckedChange={(v) => setDontShow(v === true)}
              tabIndex={showCheckbox ? 0 : -1}
            />
            <Label
              htmlFor="welcome-dont-show"
              className={cn(MICRO, "font-normal")}
            >
              {t.welcome.dontShowAgain}
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-3">
          <div className="justify-self-start">
            {isFirst ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onContinue(dontShow)}
                className="text-muted-foreground px-3"
              >
                {t.welcome.skipTutorial}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={goPrev}
                aria-label={t.welcome.back}
                className="h-10 w-16"
              >
                <ChevronLeft className="size-6" aria-hidden />
              </Button>
            )}
          </div>

          <div
            role="group"
            aria-label={stepLabel}
            className="flex items-center justify-center gap-3"
          >
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-current={i === step ? "step" : undefined}
                aria-label={t.welcome.goToStep.replace("{n}", String(i + 1))}
                onClick={() => setStep(i)}
                className={cn(
                  "rounded-full transition-all",
                  i === step
                    ? "bg-primary size-2.5"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50 size-2",
                )}
              />
            ))}
          </div>

          <div className="justify-self-end">
            {isLast ? (
              <Button type="button" onClick={() => onContinue(dontShow)} className="px-4">
                {t.welcome.start}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={goNext}
                aria-label={t.welcome.next}
                className="h-10 w-16"
              >
                <ChevronRight className="size-6" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
