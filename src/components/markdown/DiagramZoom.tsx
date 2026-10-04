import { Maximize, Maximize2, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const MIN_SCALE = 0.1
const MAX_SCALE = 8
const STEP = 1.25

interface View {
  x: number
  y: number
  scale: number
}

const clamp = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

/** Scales the view by `factor` while keeping the point (px, py) of the viewport still. */
function zoomAt(view: View, factor: number, px: number, py: number): View {
  const scale = clamp(view.scale * factor)
  const k = scale / view.scale
  return { scale, x: px - (px - view.x) * k, y: py - (py - view.y) * k }
}

function fitView(viewport: HTMLElement, svg: SVGSVGElement): View {
  const { width, height } = svg.viewBox.baseVal
  const pad = 32
  const scale = clamp(Math.min((viewport.clientWidth - pad) / width, (viewport.clientHeight - pad) / height, 2))
  return {
    scale,
    x: (viewport.clientWidth - width * scale) / 2,
    y: (viewport.clientHeight - height * scale) / 2,
  }
}

function ZoomButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Full-screen viewer for a rendered diagram. Drag or scroll to pan;
 * pinch, Ctrl/⌘ + scroll, the buttons or +/-/0 to zoom.
 */
function DiagramViewer({ svg }: { svg: string }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  const svgEl = () => contentRef.current?.querySelector('svg') ?? null

  const fit = useCallback(() => {
    const viewport = viewportRef.current
    const el = contentRef.current?.querySelector('svg')
    if (viewport && el) setView(fitView(viewport, el))
  }, [])

  // Draw the SVG at its natural size; the transform does the scaling.
  useLayoutEffect(() => {
    const el = svgEl()
    if (!el) return
    const { width, height } = el.viewBox.baseVal
    el.removeAttribute('style')
    el.setAttribute('width', String(width))
    el.setAttribute('height', String(height))
    fit()
  }, [svg, fit])

  const zoomCenter = useCallback((factor: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    setView((v) => v && zoomAt(v, factor, viewport.clientWidth / 2, viewport.clientHeight / 2))
  }, [])

  // React's wheel listener is passive, so preventDefault needs a native one.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      setView((v) => {
        if (!v) return v
        // Trackpad pinch arrives as a wheel event with ctrlKey set.
        if (event.ctrlKey || event.metaKey) {
          return zoomAt(v, Math.exp(-event.deltaY * 0.01), event.clientX - rect.left, event.clientY - rect.top)
        }
        return { ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }
      })
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const map = pointers.current
    const prev = map.get(event.pointerId)
    if (!prev) return
    const next = { x: event.clientX, y: event.clientY }
    if (map.size === 1) {
      setView((v) => v && { ...v, x: v.x + next.x - prev.x, y: v.y + next.y - prev.y })
    } else if (map.size === 2) {
      // Two-finger pinch: zoom by the change in finger distance, around their midpoint.
      const other = [...map.entries()].find(([id]) => id !== event.pointerId)![1]
      const before = Math.hypot(prev.x - other.x, prev.y - other.y)
      const after = Math.hypot(next.x - other.x, next.y - other.y)
      const rect = event.currentTarget.getBoundingClientRect()
      const mx = (next.x + other.x) / 2 - rect.left
      const my = (next.y + other.y) / 2 - rect.top
      if (before > 0) setView((v) => v && zoomAt(v, after / before, mx, my))
    }
    map.set(event.pointerId, next)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === '+' || event.key === '=') zoomCenter(STEP)
    else if (event.key === '-') zoomCenter(1 / STEP)
    else if (event.key === '0') fit()
    else return
    event.preventDefault()
  }

  return (
    <div className="grid min-h-0 grid-rows-[auto_1fr]" onKeyDown={onKeyDown}>
      <div className="flex items-center gap-1 border-b py-2 pr-12 pl-4">
        <DialogTitle className="mr-auto">Diagram</DialogTitle>
        <DialogDescription className="sr-only">
          Drag or scroll to pan. Pinch, Ctrl or Command plus scroll, or the plus and minus keys to zoom. Zero fits
          the diagram to the window.
        </DialogDescription>
        <ZoomButton label="Zoom out" onClick={() => zoomCenter(1 / STEP)}>
          <Minus />
        </ZoomButton>
        <span className="w-12 text-center font-mono text-xs text-muted-foreground tabular-nums">
          {view ? `${Math.round(view.scale * 100)}%` : ''}
        </span>
        <ZoomButton label="Zoom in" onClick={() => zoomCenter(STEP)}>
          <Plus />
        </ZoomButton>
        <ZoomButton label="Fit to window" onClick={fit}>
          <Maximize />
        </ZoomButton>
      </div>
      <div
        ref={viewportRef}
        className="relative cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={contentRef}
          className="mermaid-diagram absolute top-0 left-0 origin-top-left"
          style={{
            transform: view ? `translate(${view.x}px, ${view.y}px) scale(${view.scale})` : undefined,
            visibility: view ? 'visible' : 'hidden',
          }}
          // Mermaid's own output under securityLevel 'strict' (DOMPurify-sanitized).
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  )
}

/**
 * A rendered diagram with an expand button that opens it in a zoomable,
 * full-screen viewer. `id` is the diagram's Mermaid id; the viewer's copy
 * gets its own so the two SVGs don't share element ids.
 */
export function DiagramZoom({ id, svg, children }: { id: string; svg: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="group/diagram relative">
      {children}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Expand diagram"
              className="absolute top-2 right-2 bg-card opacity-0 transition-opacity group-hover/diagram:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
              onClick={() => setOpen(true)}
            />
          }
        >
          <Maximize2 />
        </TooltipTrigger>
        <TooltipContent>Expand diagram</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] grid-rows-1 gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)]">
          {open && <DiagramViewer svg={svg.replaceAll(id, `${id}-zoom`)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
