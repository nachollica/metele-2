"use client"

import { Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTranslations } from "@/lib/i18n"

import { PrefsControls } from "./prefs-controls"

/**
 * Language + light/dark controls, moved off the (now removed) sidebar into a
 * compact popover anchored top-right in the app header. Kept as a popover so it
 * stays out of the way on mobile, where the header is tight.
 */
export function PrefsMenu({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={t.prefs.sectionLabel}
        >
          <Settings2 className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <PrefsControls />
      </PopoverContent>
    </Popover>
  )
}
