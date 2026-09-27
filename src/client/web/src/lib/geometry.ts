import type { Cardinality, DatabaseContent, Note, Relationship, Table } from '../types'

export const FONT_FAMILY = "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"
export const HEADER_H = 40
export const ROW_H = 30
export const TABLE_MIN_W = 200
export const NOTE_LINE_H = 18
export const NOTE_HEADER_H = 34

let ctx: CanvasRenderingContext2D | null = null
const cache = new Map<string, number>()

export function measureText(text: string, font: string): number {
  const key = font + '|' + text
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  ctx ??= document.createElement('canvas').getContext('2d')
  let w = text.length * 7.5
  if (ctx) {
    ctx.font = font
    w = ctx.measureText(text).width
  }
  if (cache.size > 5000) cache.clear()
  cache.set(key, w)
  return w
}

export const headerFont = `600 14px ${FONT_FAMILY}`
export const fieldFont = `13px ${FONT_FAMILY}`
export const typeFont = `12px ${FONT_FAMILY}`

export function tableWidth(t: Table): number {
  let maxName = 0
  let maxType = 0
  for (const f of t.fields) {
    maxName = Math.max(maxName, measureText(f.name, fieldFont))
    maxType = Math.max(maxType, measureText(f.type, typeFont))
  }
  const rows = 36 + maxName + 24 + maxType + 16
  const header = measureText(t.name, headerFont) + 40
  return Math.ceil(Math.max(TABLE_MIN_W, rows, header))
}

export function tableHeight(t: Table): number {
  return HEADER_H + Math.max(1, t.fields.length) * ROW_H
}

export function noteLines(n: Note): string[] {
  return n.content === '' ? [] : n.content.split('\n')
}

export const noteTitleFont = `600 13px ${FONT_FAMILY}`
export const noteFont = `12px ${FONT_FAMILY}`

/** Notes grow to fit their longest line so text is never clipped. */
export function noteWidth(n: Note): number {
  const longest = Math.max(measureText(n.title, noteTitleFont), ...noteLines(n).map((l) => measureText(l, noteFont)))
  return Math.ceil(Math.max(n.width, longest + 28))
}

export function noteHeight(n: Note): number {
  return NOTE_HEADER_H + Math.max(1, noteLines(n).length) * NOTE_LINE_H + 12
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function contentBounds(content: DatabaseContent, pad = 40): Rect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const add = (x: number, y: number, w: number, h: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }
  for (const t of content.tables) add(t.x, t.y, tableWidth(t), tableHeight(t))
  for (const n of content.notes) add(n.x, n.y, noteWidth(n), noteHeight(n))
  if (minX === Infinity) return null
  return { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 }
}

export interface Endpoint {
  x: number
  y: number
  /** +1 when the edge leaves to the right, -1 to the left. */
  dir: 1 | -1
}

function rowY(t: Table, fieldId: string): number {
  const i = Math.max(0, t.fields.findIndex((f) => f.id === fieldId))
  return t.y + HEADER_H + i * ROW_H + ROW_H / 2
}

export interface EdgeGeometry {
  d: string
  start: Endpoint
  end: Endpoint
  mid: { x: number; y: number }
}

export function edgeGeometry(rel: Relationship, tables: Map<string, Table>): EdgeGeometry | null {
  const a = tables.get(rel.startTableId)
  const b = tables.get(rel.endTableId)
  if (!a || !b) return null
  const aw = tableWidth(a)
  const bw = tableWidth(b)
  const ay = rowY(a, rel.startFieldId)
  const by = rowY(b, rel.endFieldId)
  const gap = 24

  let start: Endpoint
  let end: Endpoint
  if (a.id !== b.id && a.x + aw + gap <= b.x) {
    start = { x: a.x + aw, y: ay, dir: 1 }
    end = { x: b.x, y: by, dir: -1 }
  } else if (a.id !== b.id && b.x + bw + gap <= a.x) {
    start = { x: a.x, y: ay, dir: -1 }
    end = { x: b.x + bw, y: by, dir: 1 }
  } else {
    // Overlapping horizontally (or self reference): loop around the right side.
    start = { x: a.x + aw, y: ay, dir: 1 }
    end = { x: b.x + bw, y: by, dir: 1 }
  }
  return { d: curve(start, end), start, end, mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } }
}

export function curve(start: Endpoint, end: Endpoint): string {
  let c1x: number
  let c2x: number
  if (start.dir === end.dir) {
    const out = Math.max(start.x, end.x) + 60
    c1x = out
    c2x = out
  } else {
    const k = Math.max(50, Math.abs(end.x - start.x) / 2)
    c1x = start.x + start.dir * k
    c2x = end.x + end.dir * k
  }
  return `M ${start.x} ${start.y} C ${c1x} ${start.y}, ${c2x} ${end.y}, ${end.x} ${end.y}`
}

/** Crow's-foot notation marker drawn at an edge endpoint. */
export function markerPath(p: Endpoint, many: boolean): string {
  const { x, y, dir } = p
  const bar = `M ${x + dir * 16} ${y - 7} L ${x + dir * 16} ${y + 7}`
  if (!many) return `${bar} M ${x + dir * 10} ${y - 7} L ${x + dir * 10} ${y + 7}`
  return `M ${x} ${y - 8} L ${x + dir * 12} ${y} M ${x} ${y + 8} L ${x + dir * 12} ${y} M ${x} ${y} L ${x + dir * 12} ${y} ${bar}`
}

export function manySides(c: Cardinality): { start: boolean; end: boolean } {
  return { start: c === 'many_to_one', end: c === 'one_to_many' }
}
