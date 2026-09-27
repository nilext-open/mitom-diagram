import { memo } from 'react'
import { edgeGeometry, manySides, markerPath } from '../../lib/geometry'
import type { CanvasPalette } from '../../state/theme'
import type { Relationship, Table } from '../../types'

interface Props {
  rel: Relationship
  tables: Map<string, Table>
  palette: CanvasPalette
  active: boolean
  onPointerDown(e: React.PointerEvent, rel: Relationship): void
}

export const EdgeView = memo(function EdgeView({ rel, tables, palette: p, active, onPointerDown }: Props) {
  const g = edgeGeometry(rel, tables)
  if (!g) return null
  const many = manySides(rel.cardinality)
  const color = active ? p.edgeActive : p.edge
  const width = active ? 2.25 : 1.5
  return (
    <g className="edge" onPointerDown={(e) => onPointerDown(e, rel)}>
      <title>{rel.name || rel.cardinality.replace(/_/g, ' ')}</title>
      <path data-export-ignore d={g.d} stroke="transparent" strokeWidth={14} fill="none" />
      <path className="edge-line" d={g.d} stroke={color} strokeWidth={width} fill="none" />
      <path className="edge-line" d={markerPath(g.start, many.start)} stroke={color} strokeWidth={width} fill="none" />
      <path className="edge-line" d={markerPath(g.end, many.end)} stroke={color} strokeWidth={width} fill="none" />
    </g>
  )
})
