"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { ExternalLink, RotateCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useLocale, useTranslations } from "@/lib/i18n"
import { loadQuotes, quoteBlocks, quoteOfTheDay, quoteTitle, type Quote } from "@/lib/flowfic/quotes"
import { useInspiration, type InspirationImageData } from "@/lib/flowfic/inspiration"

import { CARD_TITLE_CLASS, HEADER_ACTION_CLASS, QuoteCard } from "./dashboard-widgets"

// How fast the wheel zooms. Multiplicative per wheel delta so it feels even
// across the range.
const ZOOM_SENSITIVITY = 0.0015

/**
 * Cross-fade <img>: starts transparent and fades in once the (cross-origin)
 * film-grab image has loaded, so a slow network reveals the picture softly into
 * its already-reserved box instead of popping. Resets on every `src` change
 * (e.g. a refresh) so each new image fades in too.
 *
 * Aspect guardrail: `object-cover` + `size-full` make the still fill its parent
 * frame (the card's fixed 16:9 box) by cropping the overflowing edge — never by
 * stretching. So any source proportion (16:9, 4:3, wide cinema, even portrait)
 * renders consistently and is never distorted; at most it is cropped a little.
 */
function FadeInImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setLoaded(false)
  }, [src])
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onLoad={() => setLoaded(true)}
      className={cn(
        "size-full object-cover transition-opacity duration-500",
        loaded ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  )
}

/**
 * External credit link to the film's film-grab page, styled like a section
 * "Show all" action (ghost Button) but rendered as a real anchor that opens in a
 * new tab. Responsive label: the full sentence on wide cards, just the domain at
 * mid width, and the icon alone when narrow — the accessible name stays complete
 * at every size.
 */
function InspirationCredit({ image }: { image: InspirationImageData }) {
  const t = useTranslations()
  const label = t.dashboard.inspirationCreditLabel.replace("{title}", image.title)
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn(HEADER_ACTION_CLASS, "shrink-0")}
    >
      <a href={image.loc} target="_blank" rel="noopener noreferrer" aria-label={label}>
        <span className="hidden lg:inline">{t.dashboard.inspirationCredit}</span>
        <span className="hidden md:inline lg:hidden">{t.dashboard.inspirationCreditShort}</span>
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </Button>
  )
}

/**
 * Landscape (16:9) inspiration image, wrapped as a dashboard card. Unlike the
 * other landing cards its title is dynamic: it *is* the picked film's name, with
 * the refresh control preceding it (while the catalog loads or is absent the
 * title falls back to a generic label and the actions hide). The title truncates
 * with an ellipsis instead of wrapping, since film-grab names can run arbitrarily
 * long. The film-grab credit link stays at the far end of the header; below sits
 * the image in a reserved 16:9 box that fades in on load.
 */
export function InspirationImage({ className }: { className?: string }) {
  const t = useTranslations()
  const { state, refresh } = useInspiration()
  const image = state.status === "ready" ? state.image : null

  return (
    <div
      className={cn(
        "bg-card text-card-foreground overflow-hidden rounded-2xl border shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-4">
        <div className="flex min-w-0 items-center gap-1">
          {image ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={refresh}
              aria-label={t.dashboard.inspirationRefresh}
              className={cn(HEADER_ACTION_CLASS, "shrink-0")}
            >
              <RotateCw className="size-4" aria-hidden />
            </Button>
          ) : null}
          <h3 className={cn(CARD_TITLE_CLASS, "text-muted-foreground min-w-0 truncate")}>
            {image ? image.title : t.dashboard.inspirationTitle}
          </h3>
        </div>
        {image ? <InspirationCredit image={image} /> : null}
      </div>

      <div className="bg-muted aspect-video w-full">
        {image ? <FadeInImage src={image.img} alt="" /> : null}
      </div>
    </div>
  )
}

/**
 * Inspiration image for the split game/setup pane, zoomable and pannable.
 *
 * Unlike the landing card (a fixed 16:9 cover-crop), this pane shows the still at
 * its ORIGINAL proportions: `object-contain` fits the whole frame inside the
 * viewport, so at rest it fits the width and is centered vertically (min zoom =
 * fully visible, reaching the left/right edges) whatever the source ratio. The
 * only transform applied is a uniform `scale` (plus a horizontal `translate`),
 * so the picture is never stretched or squashed — the source proportions hold at
 * every zoom level.
 *
 * Vertical wheel zooms in, up to the point where the image fills the pane's
 * height — for a landscape image that crops the sides (max zoom). Once zoomed, a
 * horizontal wheel (or shift+wheel) and click-and-drag pan left/right to reveal
 * the cropped edges. The wheel is captured (never scrolls the pane) via a
 * non-passive listener; the max zoom and pan are recomputed whenever the pane or
 * image size changes.
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
  const [loaded, setLoaded] = useState(false)
  const { state } = useInspiration()
  const image = state.status === "ready" ? state.image : null

  // Fade a newly picked image (or the first arrival) back in from transparent.
  useEffect(() => {
    setLoaded(false)
  }, [image?.img])

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
      aria-label={image ? `${t.dashboard.inspirationAlt}: ${image.title}` : t.dashboard.inspirationAlt}
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
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={image.img}
          alt=""
          aria-hidden
          draggable={false}
          onLoad={() => {
            setLoaded(true)
            recomputeMax()
          }}
          style={{
            transform: `translateX(${offsetX}px) scale(${zoom})`,
            opacity: loaded ? 1 : 0,
          }}
          className="h-full w-full origin-center object-contain transition-opacity duration-500 will-change-transform"
        />
      ) : null}
    </div>
  )
}

/**
 * Full-width "quote of the day" card (landing only). Loads the curated quote pool
 * once, picks today's deterministically, and renders it with attribution. Shows a
 * skeleton until the pool loads; renders nothing if it is empty/unavailable.
 */
export function QuoteOfDay({ className }: { className?: string }) {
  const t = useTranslations()
  const locale = useLocale()
  const [quotes, setQuotes] = useState<readonly Quote[] | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void loadQuotes().then((q) => {
      if (!cancelled) setQuotes(q)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (quotes === undefined) {
    return <QuoteCard title={t.dashboard.quoteOfDay} skeleton className={className} />
  }

  const quote = quotes ? quoteOfTheDay(quotes) : null
  if (!quote) return null

  return (
    <QuoteCard
      title={t.dashboard.quoteOfDay}
      blocks={quoteBlocks(quote, locale)}
      attribution={`${quote.author} · ${quoteTitle(quote, locale)}`}
      className={className}
    />
  )
}
