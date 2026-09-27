import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { curve, type Endpoint, HEADER_H, ROW_H, tableWidth } from '../../lib/geometry'
import { fkSides } from '../../lib/sql'
import { canvasEl, zoomAt } from '../../lib/viewport'
import { useEditor } from '../../state/editor'
import { usePalette } from '../../state/theme'
import type { Cardinality, Field, Note, Relationship, Table } from '../../types'
import { EdgeView } from './EdgeView'
import { NoteNode } from './NoteNode'
import { TableNode } from './TableNode'

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'move'; target: 'table' | 'note'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { kind: 'link'; tableId: string; fieldId: string; start: Endpoint }

const DRAG_THRESHOLD = 3

function defaultCardinality(from: Field, to: Field): Cardinality {
  if (from.primary && !to.primary) return 'one_to_many'
  if (from.unique && to.unique) return 'one_to_one'
  return 'many_to_one'
}

export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [linkPreview, setLinkPreview] = useState<{ start: Endpoint; x: number; y: number } | null>(null)
  const [panning, setPanning] = useState(false)

  const content = useEditor((s) => s.diagram?.content)
  const viewport = useEditor((s) => s.viewport)
  const selection = useEditor((s) => s.selection)
  const palette = usePalette()

  const tableMap = useMemo(() => new Map((content?.tables ?? []).map((t) => [t.id, t])), [content?.tables])
  const fkFieldIds = useMemo(() => {
    const byTable = new Map<string, Set<string>>()
    for (const r of content?.relationships ?? []) {
      const s = fkSides(r)
      if (!byTable.has(s.childTableId)) byTable.set(s.childTableId, new Set())
      byTable.get(s.childTableId)!.add(s.childFieldId)
    }
    return byTable
  }, [content?.relationships])

  useEffect(() => {
    canvasEl.current = svgRef.current
    return () => {
      canvasEl.current = null
    }
  }, [])

  // React's onWheel is passive, so preventDefault needs a native listener.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      if (e.shiftKey && !e.ctrlKey) {
        const { viewport: v, setViewport } = useEditor.getState()
        setViewport({ ...v, x: v.x - (e.deltaY || e.deltaX), y: v.y })
        return
      }
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - rect.left, e.clientY - rect.top)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const v = useEditor.getState().viewport
    return { x: (clientX - rect.left - v.x) / v.zoom, y: (clientY - rect.top - v.y) / v.zoom }
  }, [])

  const capture = (e: React.PointerEvent) => svgRef.current?.setPointerCapture(e.pointerId)

  const startPan = (e: React.PointerEvent) => {
    const v = useEditor.getState().viewport
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, moved: false }
    setPanning(true)
    capture(e)
  }

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    startPan(e)
  }

  const onTableDown = useCallback((e: React.PointerEvent, table: Table) => {
    e.stopPropagation()
    if (e.button === 1) return startPan(e)
    if (e.button !== 0) return
    useEditor.getState().select({ kind: 'table', id: table.id })
    drag.current = { kind: 'move', target: 'table', id: table.id, sx: e.clientX, sy: e.clientY, ox: table.x, oy: table.y, moved: false }
    capture(e)
  }, [])

  const onNoteDown = useCallback((e: React.PointerEvent, note: Note) => {
    e.stopPropagation()
    if (e.button === 1) return startPan(e)
    if (e.button !== 0) return
    useEditor.getState().select({ kind: 'note', id: note.id })
    drag.current = { kind: 'move', target: 'note', id: note.id, sx: e.clientX, sy: e.clientY, ox: note.x, oy: note.y, moved: false }
    capture(e)
  }, [])

  const onEdgeDown = useCallback((e: React.PointerEvent, rel: Relationship) => {
    e.stopPropagation()
    if (e.button !== 0) return
    useEditor.getState().select({ kind: 'relationship', id: rel.id })
  }, [])

  const onHandleDown = useCallback((e: React.PointerEvent, table: Table, field: Field, side: 'left' | 'right') => {
    e.stopPropagation()
    if (e.button !== 0) return
    const i = table.fields.findIndex((f) => f.id === field.id)
    const start: Endpoint = {
      x: side === 'left' ? table.x : table.x + tableWidth(table),
      y: table.y + HEADER_H + i * ROW_H + ROW_H / 2,
      dir: side === 'left' ? -1 : 1,
    }
    drag.current = { kind: 'link', tableId: table.id, fieldId: field.id, start }
    setLinkPreview({ start, x: start.x, y: start.y })
    capture(e)
  }, [])

  const onTableDoubleClick = useCallback((table: Table) => {
    useEditor.getState().select({ kind: 'table', id: table.id })
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-table-name-input="${table.id}"]`)?.focus())
  }, [])

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const state = useEditor.getState()
    if (d.kind === 'pan') {
      d.moved ||= Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > DRAG_THRESHOLD
      state.setViewport({ ...state.viewport, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy })
    } else if (d.kind === 'move') {
      const dx = (e.clientX - d.sx) / state.viewport.zoom
      const dy = (e.clientY - d.sy) / state.viewport.zoom
      if (!d.moved) {
        if (Math.hypot(dx, dy) * state.viewport.zoom < DRAG_THRESHOLD) return
        d.moved = true
        state.checkpoint()
      }
      const x = Math.round(d.ox + dx)
      const y = Math.round(d.oy + dy)
      state.mutate((c) => {
        const item = d.target === 'table' ? c.tables.find((t) => t.id === d.id) : c.notes.find((n) => n.id === d.id)
        if (item) {
          item.x = x
          item.y = y
        }
      })
    } else {
      const p = toWorld(e.clientX, e.clientY)
      setLinkPreview({ start: d.start, x: p.x, y: p.y })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    setPanning(false)
    if (!d) return
    const state = useEditor.getState()
    if (d.kind === 'pan' && !d.moved && e.button !== 1) {
      state.select(null)
    } else if (d.kind === 'link') {
      setLinkPreview(null)
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGGElement>('[data-field-id]')
      const endTableId = row?.dataset.tableId
      const endFieldId = row?.dataset.fieldId
      if (!endTableId || !endFieldId || (endTableId === d.tableId && endFieldId === d.fieldId)) return
      const content = state.diagram?.content
      const from = content?.tables.find((t) => t.id === d.tableId)?.fields.find((f) => f.id === d.fieldId)
      const to = content?.tables.find((t) => t.id === endTableId)?.fields.find((f) => f.id === endFieldId)
      if (!from || !to) return
      state.addRelationship({
        startTableId: d.tableId,
        startFieldId: d.fieldId,
        endTableId,
        endFieldId,
        cardinality: defaultCardinality(from, to),
      })
    }
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as Element).getAttribute('data-bg') === null) return
    const p = toWorld(e.clientX, e.clientY)
    useEditor.getState().addTable(p.x - 100, p.y - 20)
  }

  if (!content) return null

  const selectedTableId = selection?.kind === 'table' ? selection.id : null
  const gridSize = 24 * viewport.zoom
  const dot = Math.max(0.6, 1.1 * viewport.zoom)

  return (
    <svg
      ref={svgRef}
      className={`canvas${panning ? ' panning' : ''}${linkPreview ? ' linking' : ''}`}
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse" x={viewport.x % gridSize} y={viewport.y % gridSize}>
          <circle cx={dot} cy={dot} r={dot} fill={palette.grid} />
        </pattern>
        <filter id="table-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.12" />
        </filter>
      </defs>
      <rect data-bg width="100%" height="100%" fill={palette.background} />
      <rect data-bg width="100%" height="100%" fill="url(#grid)" />

      <g data-world transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
        {content.notes.map((n) => (
          <NoteNode key={n.id} note={n} palette={palette} selected={selection?.id === n.id} onPointerDown={onNoteDown} />
        ))}
        {content.relationships.map((r) => (
          <EdgeView
            key={r.id}
            rel={r}
            tables={tableMap}
            palette={palette}
            active={selection?.id === r.id || r.startTableId === selectedTableId || r.endTableId === selectedTableId}
            onPointerDown={onEdgeDown}
          />
        ))}
        {content.tables.map((t) => (
          <TableNode
            key={t.id}
            table={t}
            palette={palette}
            selected={selectedTableId === t.id}
            fkFieldIds={fkFieldIds.get(t.id) ?? EMPTY}
            onPointerDown={onTableDown}
            onHandleDown={onHandleDown}
            onDoubleClick={onTableDoubleClick}
          />
        ))}
        {linkPreview && (
          <path
            data-export-ignore
            d={curve(linkPreview.start, { x: linkPreview.x, y: linkPreview.y, dir: linkPreview.x >= linkPreview.start.x ? -1 : 1 })}
            stroke={palette.accent}
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="none"
            pointerEvents="none"
          />
        )}
      </g>
    </svg>
  )
}

const EMPTY: ReadonlySet<string> = new Set()
