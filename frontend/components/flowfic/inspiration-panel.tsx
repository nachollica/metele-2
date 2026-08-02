"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

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
 * Inspiration image for the split game/setup pane, zoomable and pannable.
 *
 * The viewport fills the pane; the image is `object-contain`, so at rest it fits
 * the width and is centered vertically (min zoom = fully visible, reaching the
 * left/right edges). Vertical wheel zooms in, up to the point where the image
 * fills the pane's height — for a landscape image that crops the sides (max
 * zoom). Once zoomed, a horizontal wheel (or shift+wheel) and click-and-drag pan
 * left/right to reveal the cropped edges. The wheel is captured (never scrolls
 * the pane) via a non-passive listener; the max zoom and pan are recomputed
 * whenever the pane or image size changes.
 */
export function ZoomableInspirationImage({ className }: { className?: string }) {
  const t = useTranslations()
  const viewportRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const maxZoomRef = useRef(1)
  const zoomRef = useRef(1)
  const offsetRef = useRef(0)
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])
  useEffect(() => {
    offsetRef.current = offsetX
  }, [offsetX])

  // Max horizontal pan (px) at a given zoom: half the image's overflow past the
  // pane. Zero at min zoom (nothing overflows), so panning is a no-op there.
  const maxOffsetFor = useCallback((z: number) => {
    const vp = viewportRef.current
    if (!vp) return 0
    return (vp.clientWidth * (z - 1)) / 2
  }, [])

  const clampOffset = useCallback(
    (x: number, z: number) => {
      const max = maxOffsetFor(z)
      return Math.min(max, Math.max(-max, x))
    },
    [maxOffsetFor],
  )

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
    setZoom((z) => {
      const nz = Math.min(z, max)
      setOffsetX((x) => clampOffset(x, nz))
      return nz
    })
  }, [clampOffset])

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
      // Horizontal intent (trackpad swipe or shift+wheel) pans; otherwise zoom.
      const horizontal = e.shiftKey ? e.deltaY : e.deltaX
      if (Math.abs(horizontal) > Math.abs(e.deltaY)) {
        setOffsetX((x) => clampOffset(x - horizontal, zoomRef.current))
        return
      }
      setZoom((z) => {
        const nz = Math.min(maxZoomRef.current, Math.max(1, z * Math.exp(-e.deltaY * ZOOM_SENSITIVITY)))
        setOffsetX((x) => clampOffset(x, nz))
        return nz
      })
    }
    // Non-passive so preventDefault holds (React's onWheel is passive).
    vp.addEventListener("wheel", onWheel, { passive: false })
    return () => vp.removeEventListener("wheel", onWheel)
  }, [clampOffset])

  const canPan = maxOffsetFor(zoom) > 0

  function onPointerDown(e: ReactPointerEvent) {
    if (!canPan) return
    dragRef.current = { startX: e.clientX, startOffset: offsetRef.current }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current
    if (!d) return
    setOffsetX(clampOffset(d.startOffset + (e.clientX - d.startX), zoomRef.current))
  }
  function endDrag(e: ReactPointerEvent) {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div
      ref={viewportRef}
      role="img"
      aria-label={t.dashboard.inspirationAlt}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        "bg-muted relative h-full w-full touch-none overflow-hidden rounded-2xl border shadow-sm select-none",
        canPan && (dragging ? "cursor-grabbing" : "cursor-grab"),
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
        style={{ transform: `translateX(${offsetX}px) scale(${zoom})` }}
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
