"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "@/lib/i18n"
import { DAILY_PROMPTS } from "@/lib/flowfic/prompts"
import { dailyPromptIndex } from "@/lib/flowfic/gamification"

import { Panel, SectionHeader } from "./dashboard-widgets"

// Placeholder inspiration image. The real feature (movie stills chosen per
// session) comes later; for now we show a stable landscape placeholder so the
// layout is real. A fixed seed keeps the same image across renders instead of
// flickering to a new one on every mount.
const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/flowfic/1280/720"

// How fast the wheel zooms. Multiplicative per wheel delta so it feels even
// across the range.
const ZOOM_SENSITIVITY = 0.0015

/** Landscape (16:9) inspiration image. Decorative placeholder for now. */
export function InspirationImage({ className }: { className?: string }) {
  const t = useTranslations()
  return (
    <div
      className={cn(
        "bg-muted aspect-video w-full overflow-hidden rounded-2xl border shadow-sm",
        className,
      )}
    >
      {/* Plain <img>: the app is a static export. Real image logic lands later. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PLACEHOLDER_IMAGE}
        alt={t.dashboard.inspirationAlt}
        className="size-full object-cover"
      />
    </div>
  )
}

/**
 * Inspiration image for the split game/setup pane, zoomable with the wheel.
 *
 * The viewport fills the pane; the image is `object-contain`, so at rest it fits
 * the width and is centered vertically (min zoom = fully visible, reaching the
 * left/right edges). Scrolling up zooms in, up to the point where the image
 * fills the pane's height — for a landscape image that crops the sides (max
 * zoom). The wheel is captured (never scrolls the pane) via a non-passive
 * listener, and the max is recomputed whenever the pane or image size changes.
 */
export function ZoomableInspirationImage({ className }: { className?: string }) {
  const t = useTranslations()
  const viewportRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const maxZoomRef = useRef(1)
  const [zoom, setZoom] = useState(1)

  const recomputeMax = useCallback(() => {
    const vp = viewportRef.current
    const img = imgRef.current
    if (!vp || !img || !img.naturalWidth || !img.naturalHeight) return
    const { clientWidth: w, clientHeight: h } = vp
    if (!w || !h) return
    // Height the image renders at when fitted to the pane width (object-contain
    // in a pane taller than this). Max zoom scales that up to the pane height.
    const fittedHeight = w * (img.naturalHeight / img.naturalWidth)
    const max = Math.max(1, h / fittedHeight)
    maxZoomRef.current = max
    setZoom((z) => Math.min(z, max))
  }, [])

  useEffect(() => {
    recomputeMax()
    const vp = viewportRef.current
    if (!vp) return
    const ro = new ResizeObserver(recomputeMax)
    ro.observe(vp)
    return () => ro.disconnect()
  }, [recomputeMax])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      setZoom((z) =>
        Math.min(maxZoomRef.current, Math.max(1, z * Math.exp(-e.deltaY * ZOOM_SENSITIVITY))),
      )
    }
    // Non-passive so preventDefault holds (React's onWheel is passive).
    vp.addEventListener("wheel", onWheel, { passive: false })
    return () => vp.removeEventListener("wheel", onWheel)
  }, [])

  return (
    <div
      ref={viewportRef}
      role="img"
      aria-label={t.dashboard.inspirationAlt}
      className={cn(
        "bg-muted relative h-full w-full overflow-hidden rounded-2xl border shadow-sm",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={PLACEHOLDER_IMAGE}
        alt=""
        aria-hidden
        draggable={false}
        onLoad={recomputeMax}
        style={{ transform: `scale(${zoom})` }}
        className="h-full w-full origin-center object-contain will-change-transform"
      />
    </div>
  )
}

/** Prompt-of-the-day card (landing only; the split pane shows image alone). */
export function PromptOfDay({ className }: { className?: string }) {
  const t = useTranslations()
  const locale = useLocale()
  const prompt = DAILY_PROMPTS[locale][dailyPromptIndex(DAILY_PROMPTS[locale].length)]

  return (
    <Panel className={cn("flex flex-col", className)}>
      <SectionHeader title={t.dashboard.promptOfDay} />
      <p className="text-foreground/80 flex-1 text-xl leading-snug font-medium italic">
        &ldquo;{prompt}&rdquo;
      </p>
    </Panel>
  )
}
