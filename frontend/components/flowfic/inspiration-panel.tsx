"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Loader2, Wand2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "@/lib/i18n"
import { quoteBlocks, quoteTitle, type Quote } from "@/lib/flowfic/quotes"
import { useInspiration } from "@/lib/flowfic/inspiration"

// How fast the wheel zooms. Multiplicative per wheel delta so it feels even
// across the range.
const ZOOM_SENSITIVITY = 0.0015

/**
 * Cross-fade <img>: starts transparent and fades in once the (cross-origin)
 * film-grab image has loaded, so a slow network reveals the picture softly into
 * its already-reserved box instead of popping. Resets on every `src` change
 * (e.g. a re-roll) so each new image fades in too.
 *
 * Aspect guardrail: `object-cover` + `size-full` make the still fill its parent
 * frame by cropping the overflowing edge — never by stretching. So any source
 * proportion (16:9, 4:3, wide cinema, even portrait) renders consistently and is
 * never distorted; at most it is cropped a little.
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
 * A quote rendered as the inspiration itself: large, centred, with the serif
 * quote mark that used to head the quote-of-the-day card. Fills whatever box it
 * is given (the home card's 4:3 frame, or the in-game pane), scrolling inside
 * rather than pushing the frame around for a long multi-block passage.
 */
export function InspirationQuote({ quote, className }: { quote: Quote; className?: string }) {
  const locale = useLocale()
  const blocks = quoteBlocks(quote, locale)
  return (
    <figure
      className={cn(
        "relative flex size-full flex-col items-center justify-center overflow-y-auto p-6 text-center sm:p-10",
        className,
      )}
    >
      <span
        aria-hidden
        className="text-primary/25 pointer-events-none absolute top-2 left-4 font-serif text-7xl leading-none select-none"
      >
        &ldquo;
      </span>
      <blockquote className="text-foreground relative space-y-3 font-serif text-xl leading-relaxed italic sm:text-2xl">
        {blocks.map((block, i) => (
          <p key={i}>{block}</p>
        ))}
      </blockquote>
      <figcaption className="text-muted-foreground relative mt-5 text-sm font-medium not-italic">
        — {quote.author} · {quoteTitle(quote, locale)}
      </figcaption>
    </figure>
  )
}

/**
 * The home screen's inspiration card: a full-width 4:3 frame that starts as an
 * invitation (magic wand + legend) and, on click, reveals a random film still or
 * quote — a 50/50 coin flip between the two pools. Clicking again re-rolls, so
 * the whole card is one big button; there is no title, credit link, or separate
 * refresh control by design.
 */
export function InspirationCard({ className }: { className?: string }) {
  const t = useTranslations()
  const { state, pick } = useInspiration()

  const label =
    state.status === "unset" || state.status === "unavailable"
      ? t.dashboard.inspirationPrompt
      : t.dashboard.inspirationAnother

  return (
    <button
      type="button"
      onClick={pick}
      aria-label={label}
      className={cn(
        "bg-card text-card-foreground group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border shadow-sm transition-colors",
        "hover:border-primary/40 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      {state.status === "image" ? (
        <FadeInImage src={state.image.img} alt="" />
      ) : state.status === "quote" ? (
        <InspirationQuote quote={state.quote} />
      ) : state.status === "picking" ? (
        <span role="status" className="flex size-full items-center justify-center">
          <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
        </span>
      ) : (
        <span className="text-muted-foreground group-hover:text-foreground flex size-full flex-col items-center justify-center gap-3 transition-colors">
          <Wand2 className="text-primary size-10" aria-hidden />
          <span className="text-sm font-medium">
            {state.status === "unavailable"
              ? t.dashboard.inspirationUnavailable
              : t.dashboard.inspirationPrompt}
          </span>
        </span>
      )}
    </button>
  )
}

/**
 * The in-game inspiration pane: whatever the player picked before starting,
 * frozen for the sprint (there is no control to change it mid-session). An image
 * gets the zoom/pan viewport below; a quote renders statically.
 */
export function InspirationPane({ className }: { className?: string }) {
  const { state } = useInspiration()
  if (state.status === "quote") {
    return (
      <div
        className={cn(
          "bg-card text-card-foreground h-full w-full overflow-hidden rounded-2xl border shadow-sm",
          className,
        )}
      >
        <InspirationQuote quote={state.quote} />
      </div>
    )
  }
  return <ZoomableInspirationImage className={className} />
}

/**
 * Inspiration image for the split game pane, zoomable and pannable.
 *
 * Unlike the home card (a fixed 4:3 cover-crop), this pane shows the still at
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
  const image = state.status === "image" ? state.image : null

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
