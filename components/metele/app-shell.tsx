"use client"

import { useState, type ReactNode } from "react"
import { PanelLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/components/ui/use-mobile"
import { cn } from "@/lib/utils"

import { useTranslations } from "@/lib/i18n"
import { StoriesSidebar } from "./stories-sidebar"
import type { Story } from "@/lib/metele/stories-api"

const SIDEBAR_WIDTH_DESKTOP = "w-72"

type Props = {
  children: ReactNode
  /** Bumped after a successful POST to refresh the story list. */
  storiesRefreshKey: number
  onStorySelect?: (story: Story) => void
}

/**
 * Two-column layout:
 *  - md+ (desktop / tablet): sidebar pinned on the left, main area beside it.
 *  - <md (mobile): sidebar collapsed; a hamburger button in the main area
 *    opens it as a left-side overlay sheet that covers the game.
 *
 * The mobile overlay is intentionally screen-wide (not a peek) per the spec.
 */
export function AppShell({ children, storiesRefreshKey, onStorySelect }: Props) {
  const t = useTranslations()
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="bg-background text-foreground flex h-dvh">
      {/* Desktop sidebar — always visible, fills its column. */}
      <aside
        className={cn(
          "bg-card hidden shrink-0 border-r md:flex md:flex-col",
          SIDEBAR_WIDTH_DESKTOP,
        )}
        aria-label={t.sidebar.title}
      >
        <StoriesSidebar refreshKey={storiesRefreshKey} onSelect={onStorySelect} />
      </aside>

      {/* Mobile sidebar — sheet that covers the game. */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="flex w-[88vw] max-w-sm flex-col p-0 sm:max-w-sm">
          <SheetHeader className="sr-only">
            <SheetTitle>{t.sidebar.title}</SheetTitle>
            <SheetDescription>{t.sidebar.subtitle}</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <StoriesSidebar
              refreshKey={storiesRefreshKey}
              onSelect={
                onStorySelect
                  ? (story) => {
                      setSheetOpen(false)
                      onStorySelect(story)
                    }
                  : undefined
              }
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main pane. The sidebar toggle on mobile lives at the top-left so it
          sits above the AppHeader's own primary action. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {isMobile ? (
          <div className="flex justify-start px-4 pt-4 sm:px-6">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSheetOpen(true)}
              aria-label={t.sidebar.toggle}
              className="gap-2"
            >
              <PanelLeft className="size-4" aria-hidden />
              {t.sidebar.toggleShort}
            </Button>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
