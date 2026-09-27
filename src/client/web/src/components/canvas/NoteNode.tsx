import { memo } from 'react'
import { FONT_FAMILY, NOTE_HEADER_H, NOTE_LINE_H, noteHeight, noteLines, noteWidth } from '../../lib/geometry'
import type { CanvasPalette } from '../../state/theme'
import type { Note } from '../../types'

interface Props {
  note: Note
  palette: CanvasPalette
  selected: boolean
  onPointerDown(e: React.PointerEvent, note: Note): void
}

const FOLD = 14

export const NoteNode = memo(function NoteNode({ note, palette: p, selected, onPointerDown }: Props) {
  const w = noteWidth(note)
  const h = noteHeight(note)
  const lines = noteLines(note)
  return (
    <g className="note-node" transform={`translate(${note.x} ${note.y})`} onPointerDown={(e) => onPointerDown(e, note)}>
      {selected && <rect data-export-ignore x={-4} y={-4} width={w + 8} height={h + 8} rx={8} fill="none" stroke={p.accent} strokeWidth={2} />}
      <path d={`M 0 0 H ${w - FOLD} L ${w} ${FOLD} V ${h} H 0 Z`} fill={note.color} filter="url(#table-shadow)" />
      <path d={`M ${w - FOLD} 0 V ${FOLD} H ${w}`} fill="rgba(0,0,0,0.08)" stroke="rgba(0,0,0,0.15)" />
      <text x={12} y={NOTE_HEADER_H / 2 + 2} dominantBaseline="central" fill={p.noteText} fontSize={13} fontWeight={600} fontFamily={FONT_FAMILY}>
        {note.title}
      </text>
      <line x1={12} x2={w - 12} y1={NOTE_HEADER_H} y2={NOTE_HEADER_H} stroke="rgba(0,0,0,0.12)" />
      {lines.map((line, i) => (
        <text key={i} x={12} y={NOTE_HEADER_H + 6 + NOTE_LINE_H * i + NOTE_LINE_H / 2} dominantBaseline="central" fill={p.noteText} fontSize={12} fontFamily={FONT_FAMILY}>
          {line || ' '}
        </text>
      ))}
    </g>
  )
})
