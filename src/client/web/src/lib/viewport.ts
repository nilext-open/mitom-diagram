import { useEditor } from '../state/editor'
import { contentBounds } from './geometry'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 3

/** The mounted canvas <svg>, used for sizing and image export. */
export const canvasEl: { current: SVGSVGElement | null } = { current: null }

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

export function zoomAt(factor: number, screenX?: number, screenY?: number) {
  const { viewport, setViewport } = useEditor.getState()
  const rect = canvasEl.current?.getBoundingClientRect()
  const mx = screenX ?? (rect ? rect.width / 2 : 0)
  const my = screenY ?? (rect ? rect.height / 2 : 0)
  const zoom = clampZoom(viewport.zoom * factor)
  const k = zoom / viewport.zoom
  setViewport({ zoom, x: mx - (mx - viewport.x) * k, y: my - (my - viewport.y) * k })
}

export function resetZoom() {
  const { viewport } = useEditor.getState()
  zoomAt(1 / viewport.zoom)
}

export function fitToContent() {
  const { diagram, setViewport } = useEditor.getState()
  const rect = canvasEl.current?.getBoundingClientRect()
  if (!diagram || !rect) return
  const b = contentBounds(diagram.content)
  if (!b) {
    setViewport({ x: 0, y: 0, zoom: 1 })
    return
  }
  const zoom = clampZoom(Math.min(rect.width / b.width, rect.height / b.height, 1.2))
  setViewport({
    zoom,
    x: (rect.width - b.width * zoom) / 2 - b.x * zoom,
    y: (rect.height - b.height * zoom) / 2 - b.y * zoom,
  })
}

/** World coordinates of the visible canvas centre, for placing new items. */
export function viewCenter(): { x: number; y: number } {
  const { viewport } = useEditor.getState()
  const rect = canvasEl.current?.getBoundingClientRect()
  const w = rect?.width ?? 800
  const h = rect?.height ?? 600
  return { x: (w / 2 - viewport.x) / viewport.zoom, y: (h / 2 - viewport.y) / viewport.zoom }
}
