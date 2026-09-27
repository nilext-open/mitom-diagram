import { memo } from 'react'
import { FONT_FAMILY, HEADER_H, ROW_H, tableHeight, tableWidth } from '../../lib/geometry'
import type { CanvasPalette } from '../../state/theme'
import type { Field, Table } from '../../types'

interface Props {
  table: Table
  palette: CanvasPalette
  selected: boolean
  fkFieldIds: ReadonlySet<string>
  onPointerDown(e: React.PointerEvent, table: Table): void
  onHandleDown(e: React.PointerEvent, table: Table, field: Field, side: 'left' | 'right'): void
  onDoubleClick(table: Table): void
}

export const TableNode = memo(function TableNode({ table, palette: p, selected, fkFieldIds, onPointerDown, onHandleDown, onDoubleClick }: Props) {
  const w = tableWidth(table)
  const h = tableHeight(table)

  return (
    <g
      className="table-node"
      transform={`translate(${table.x} ${table.y})`}
      onPointerDown={(e) => onPointerDown(e, table)}
      onDoubleClick={() => onDoubleClick(table)}
    >
      <title>{table.comment || table.name}</title>
      {selected && <rect data-export-ignore x={-4} y={-4} width={w + 8} height={h + 8} rx={11} fill="none" stroke={p.accent} strokeWidth={2} />}
      <rect width={w} height={h} rx={8} fill={p.tableBg} filter="url(#table-shadow)" />
      <rect width={w} height={HEADER_H} rx={8} fill={table.color} />
      <rect y={HEADER_H - 8} width={w} height={8} fill={table.color} />
      <text x={14} y={HEADER_H / 2} dominantBaseline="central" fill={p.headerText} fontSize={14} fontWeight={600} fontFamily={FONT_FAMILY}>
        {table.name}
      </text>

      {table.fields.length === 0 && (
        <text x={w / 2} y={HEADER_H + ROW_H / 2} dominantBaseline="central" textAnchor="middle" fill={p.muted} fontSize={12} fontStyle="italic" fontFamily={FONT_FAMILY}>
          no columns
        </text>
      )}

      {table.fields.map((f, i) => {
        const y = HEADER_H + i * ROW_H
        const cy = y + ROW_H / 2
        const badge = f.primary ? 'PK' : fkFieldIds.has(f.id) ? 'FK' : ''
        return (
          <g key={f.id} className="field-row" data-table-id={table.id} data-field-id={f.id}>
            <rect y={y} width={w} height={ROW_H} fill={i % 2 ? p.rowAlt : p.tableBg} rx={i === table.fields.length - 1 ? 8 : 0} />
            {i === table.fields.length - 1 && <rect y={y} width={w} height={ROW_H / 2} fill={i % 2 ? p.rowAlt : p.tableBg} />}
            {i > 0 && <line x1={0} x2={w} y1={y} y2={y} stroke={p.rowDivider} />}
            {badge && (
              <text x={12} y={cy} dominantBaseline="central" fill={f.primary ? p.pk : p.fk} fontSize={9} fontWeight={700} fontFamily={FONT_FAMILY}>
                {badge}
              </text>
            )}
            <text
              x={36}
              y={cy}
              dominantBaseline="central"
              fill={p.text}
              fontSize={13}
              fontWeight={f.primary ? 600 : 400}
              fontFamily={FONT_FAMILY}
            >
              {f.name}
              {!f.notNull && !f.primary && <tspan fill={p.muted}>?</tspan>}
            </text>
            <text x={w - 14} y={cy} dominantBaseline="central" textAnchor="end" fill={p.muted} fontSize={12} fontFamily={FONT_FAMILY}>
              {f.type}
            </text>
            {(['left', 'right'] as const).map((side) => (
              <circle
                key={side}
                data-export-ignore
                className="handle"
                cx={side === 'left' ? 0 : w}
                cy={cy}
                r={5}
                fill={p.tableBg}
                stroke={p.accent}
                strokeWidth={2}
                onPointerDown={(e) => onHandleDown(e, table, f, side)}
              >
                <title>Drag to another column to create a relationship</title>
              </circle>
            ))}
          </g>
        )
      })}

      <rect
        width={w}
        height={h}
        rx={8}
        fill="none"
        stroke={selected ? p.accent : p.tableBorder}
        strokeWidth={1}
        pointerEvents="none"
      />
    </g>
  )
})
