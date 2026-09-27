import { ArrowLeftRight, ChevronRight, Trash2 } from 'lucide-react'
import { REF_ACTIONS } from '../../lib/dialects'
import { fkName } from '../../lib/sql'
import { useEditor } from '../../state/editor'
import type { Cardinality, RefAction, Relationship, Table } from '../../types'
import { Empty, useScrollIntoView } from './ui'

const CARDINALITIES: { value: Cardinality; label: string }[] = [
  { value: 'many_to_one', label: 'Many to one (N:1)' },
  { value: 'one_to_many', label: 'One to many (1:N)' },
  { value: 'one_to_one', label: 'One to one (1:1)' },
]

const NO_RELS: Relationship[] = []
const NO_TABLES: Table[] = []

export function RelationshipsPanel() {
  const rels = useEditor((s) => s.diagram?.content.relationships ?? NO_RELS)
  const tables = useEditor((s) => s.diagram?.content.tables ?? NO_TABLES)
  const selection = useEditor((s) => s.selection)
  const tableMap = new Map(tables.map((t) => [t.id, t]))

  return (
    <div className="panel">
      {rels.length === 0 && <Empty>No relationships yet. Drag the dot on a column's edge onto a column in another table.</Empty>}
      {rels.map((r) => (
        <RelationshipItem key={r.id} rel={r} tables={tableMap} open={selection?.kind === 'relationship' && selection.id === r.id} />
      ))}
    </div>
  )
}

function endpointLabel(tables: Map<string, Table>, tableId: string, fieldId: string) {
  const t = tables.get(tableId)
  return `${t?.name ?? '?'}.${t?.fields.find((f) => f.id === fieldId)?.name ?? '?'}`
}

function RelationshipItem({ rel, tables, open }: { rel: Relationship; tables: Map<string, Table>; open: boolean }) {
  const ed = useEditor.getState()
  const ref = useScrollIntoView<HTMLDivElement>(open)
  const from = endpointLabel(tables, rel.startTableId, rel.startFieldId)
  const to = endpointLabel(tables, rel.endTableId, rel.endFieldId)

  return (
    <div ref={ref} className={`item${open ? ' open' : ''}`}>
      <button className="item-head" onClick={() => ed.select(open ? null : { kind: 'relationship', id: rel.id })}>
        <span className="item-title mono">
          {from} <span className="muted">→</span> {to}
        </span>
        <ChevronRight size={14} className="chevron" />
      </button>
      {open && (
        <div className="item-body">
          <label className="field">
            <span>Constraint name</span>
            <input value={rel.name} placeholder={fkName(rel, tables)} onChange={(e) => ed.updateRelationship(rel.id, { name: e.target.value }, 'name')} />
          </label>
          <label className="field">
            <span>Cardinality</span>
            <select value={rel.cardinality} onChange={(e) => ed.updateRelationship(rel.id, { cardinality: e.target.value as Cardinality })}>
              {CARDINALITIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid-2">
            <label className="field">
              <span>On update</span>
              <select value={rel.onUpdate} onChange={(e) => ed.updateRelationship(rel.id, { onUpdate: e.target.value as RefAction })}>
                {REF_ACTIONS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>On delete</span>
              <select value={rel.onDelete} onChange={(e) => ed.updateRelationship(rel.id, { onDelete: e.target.value as RefAction })}>
                {REF_ACTIONS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row-actions">
            <button className="btn small" onClick={() => ed.swapRelationship(rel.id)}>
              <ArrowLeftRight size={13} /> Swap direction
            </button>
            <button className="btn small danger" onClick={() => ed.deleteRelationship(rel.id)}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
