import type { Diagram } from '../types'
import { contentBounds, FONT_FAMILY } from './geometry'
import { canvasEl } from './viewport'

export function download(filename: string, data: Blob | string, mime = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilename(name: string): string {
  return name.trim().replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'diagram'
}

export function exportJSON(d: Diagram) {
  const payload = { name: d.name, kind: d.kind, content: d.content }
  download(`${safeFilename(d.name)}.json`, JSON.stringify(payload, null, 2), 'application/json')
}

/** Serialises the rendered diagram (without editor-only chrome) to a standalone SVG. */
export function renderSVG(d: Diagram, background: string): { svg: string; width: number; height: number } | null {
  const svg = canvasEl.current
  const world = svg?.querySelector<SVGGElement>('[data-world]')
  const bounds = contentBounds(d.content)
  if (!svg || !world || !bounds) return null

  const clone = world.cloneNode(true) as SVGGElement
  clone.querySelectorAll('[data-export-ignore]').forEach((n) => n.remove())
  clone.querySelectorAll('title').forEach((n) => n.remove())
  clone.setAttribute('transform', `translate(${-bounds.x} ${-bounds.y})`)
  const defs = svg.querySelector('filter#table-shadow')?.outerHTML ?? ''

  const width = Math.ceil(bounds.width)
  const height = Math.ceil(bounds.height)
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT_FAMILY.replace(/"/g, "'")}">` +
    `<defs>${defs}</defs><rect width="100%" height="100%" fill="${background}"/>${new XMLSerializer().serializeToString(clone)}</svg>`
  return { svg: markup, width, height }
}

export function exportSVG(d: Diagram, background: string) {
  const r = renderSVG(d, background)
  if (!r) throw new Error('Nothing to export: the diagram is empty.')
  download(`${safeFilename(d.name)}.svg`, r.svg, 'image/svg+xml')
}

export async function exportPNG(d: Diagram, background: string, scale = 2) {
  const r = renderSVG(d, background)
  if (!r) throw new Error('Nothing to export: the diagram is empty.')
  const url = URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = r.width * scale
    canvas.height = r.height * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('PNG encoding failed')
    download(`${safeFilename(d.name)}.png`, blob)
  } finally {
    URL.revokeObjectURL(url)
  }
}
