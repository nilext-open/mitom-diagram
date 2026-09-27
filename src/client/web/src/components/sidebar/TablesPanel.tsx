import { ArrowDown, ArrowUp, ChevronRight, Copy, MoreHorizontal, Plus, Search, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { TABLE_COLORS } from '../../lib/model'
import { viewCenter } from '../../lib/viewport'
import { useEditor } from '../../state/editor'
import type { Field, Table } from '../../types'
import { Empty, Swatches, Toggle, useScrollIntoView } from './ui'

const NO_TABLES: Table[] = []

export function TablesPanel() {
  const tables = useEditor((s) => s.diagram?.content.tables ?? NO_TABLES)
  const selection = useEditor((s) => s.selection)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const visible = q ? tables.filter((t) => t.name.toLowerCase().includes(q) || t.fields.some((f) => f.name.toLowerCase().includes(q))) : tables

  const add = () => {
    const c = viewCenter()
    useEditor.getState().addTable(c.x - 100, c.y - 60)
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <div className="search">
          <Search size={14} />
          <input placeholder="Search tables or columns" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="btn primary" onClick={add}>
          <Plus size={14} /> Table
        </button>
      </div>
      {tables.length === 0 && <Empty>No tables yet. Click “Table” or double-click the canvas.</Empty>}
      {visible.map((t) => (
        <TableItem key={t.id} table={t} open={selection?.kind === 'table' && selection.id === t.id} />
      ))}
    </div>
  )
}

function TableItem({ table, open }: { table: Table; open: boolean }) {
  const ed = useEditor.getState()
  const ref = useScrollIntoView<HTMLDivElement>(open)

  return (
    <div ref={ref} className={`item${open ? ' open' : ''}`}>
      <button className="item-head" onClick={() => ed.select(open ? null : { kind: 'table', id: table.id })}>
        <span className="dot" style={{ background: table.color }} />
        <span className="item-title">{table.name || <em>unnamed</em>}</span>
        <span className="item-meta">{table.fields.length} cols</span>
        <ChevronRight size={14} className="chevron" />
      </button>
      {open && (
        <div className="item-body">
          <label className="field">
            <span>Name</span>
            <input
              data-table-name-input={table.id}
              value={table.name}
              onChange={(e) => ed.updateTable(table.id, { name: e.target.value }, 'name')}
            />
          </label>

          <div className="section-title">Columns</div>
          <div className="fields">
            {table.fields.map((f, i) => (
              <FieldRow key={f.id} table={table} field={f} first={i === 0} last={i === table.fields.length - 1} />
            ))}
          </div>
          <button className="btn ghost small" onClick={() => ed.addField(table.id)}>
            <Plus size={13} /> Add column
          </button>

          <IndicesEditor table={table} />

          <label className="field">
            <span>Comment</span>
            <textarea rows={2} value={table.comment} onChange={(e) => ed.updateTable(table.id, { comment: e.target.value }, 'comment')} />
          </label>

          <div className="field">
            <span>Colour</span>
            <Swatches colors={TABLE_COLORS} value={table.color} onChange={(color) => ed.updateTable(table.id, { color })} />
          </div>

          <div className="row-actions">
            <button className="btn small" onClick={() => ed.duplicateTable(table.id)}>
              <Copy size={13} /> Duplicate
            </button>
            <button className="btn small danger" onClick={() => ed.deleteTable(table.id)}>
              <Trash2 size={13} /> Delete table
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldRow({ table, field: f, first, last }: { table: Table; field: Field; first: boolean; last: boolean }) {
  const ed = useEditor.getState()
  const dialect = useEditor((s) => s.diagram?.content.dialect ?? 'generic')
  const [more, setMore] = useState(false)
  const update = (patch: Partial<Field>, key?: string) => ed.updateField(table.id, f.id, patch, key)

  return (
    <div className={`field-editor${more ? ' expanded' : ''}`}>
      <div className="field-main">
        <input className="name" value={f.name} placeholder="name" onChange={(e) => update({ name: e.target.value }, 'name')} />
        <input
          className="type"
          value={f.type}
          placeholder="type"
          list={`types-${dialect}`}
          onChange={(e) => update({ type: e.target.value.toUpperCase() }, 'type')}
        />
        <Toggle on={f.primary} label="PK" title="Primary key" onClick={() => update({ primary: !f.primary })} />
        <Toggle on={f.notNull || f.primary} label="NN" title="Not null" onClick={() => !f.primary && update({ notNull: !f.notNull })} />
        <button className="icon-btn" title="More options" onClick={() => setMore(!more)}>
          {more ? <X size={14} /> : <MoreHorizontal size={14} />}
        </button>
      </div>
      {more && (
        <div className="field-more">
          <div className="checks">
            <label>
              <input type="checkbox" checked={f.unique} onChange={() => update({ unique: !f.unique })} /> Unique
            </label>
            <label>
              <input type="checkbox" checked={f.increment} onChange={() => update({ increment: !f.increment })} /> Auto increment
            </label>
          </div>
          <label className="field">
            <span>Default</span>
            <input value={f.default} placeholder="e.g. 0, now(), 'draft'" onChange={(e) => update({ default: e.target.value }, 'default')} />
          </label>
          <label className="field">
            <span>Comment</span>
            <input value={f.comment} onChange={(e) => update({ comment: e.target.value }, 'comment')} />
          </label>
          <div className="row-actions">
            <button className="icon-btn" title="Move up" disabled={first} onClick={() => ed.moveField(table.id, f.id, -1)}>
              <ArrowUp size={14} />
            </button>
            <button className="icon-btn" title="Move down" disabled={last} onClick={() => ed.moveField(table.id, f.id, 1)}>
              <ArrowDown size={14} />
            </button>
            <span className="spacer" />
            <button className="btn small danger" onClick={() => ed.deleteField(table.id, f.id)}>
              <Trash2 size={13} /> Delete column
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function IndicesEditor({ table }: { table: Table }) {
  const ed = useEditor.getState()
  return (
    <>
      <div className="section-title">
        Indexes
        <button className="icon-btn" title="Add index" onClick={() => ed.addIndex(table.id)}>
          <Plus size={14} />
        </button>
      </div>
      {table.indices.map((idx) => (
        <div key={idx.id} className="index-editor">
          <div className="field-main">
            <input className="name" value={idx.name} onChange={(e) => ed.updateIndex(table.id, idx.id, { name: e.target.value }, 'name')} />
            <Toggle on={idx.unique} label="UQ" title="Unique index" onClick={() => ed.updateIndex(table.id, idx.id, { unique: !idx.unique })} />
            <button className="icon-btn" title="Delete index" onClick={() => ed.deleteIndex(table.id, idx.id)}>
              <Trash2 size={14} />
            </button>
          </div>
          <div className="chips">
            {table.fields.map((f) => {
              const on = idx.fieldIds.includes(f.id)
              return (
                <button
                  key={f.id}
                  className={`chip${on ? ' on' : ''}`}
                  onClick={() =>
                    ed.updateIndex(table.id, idx.id, {
                      fieldIds: on ? idx.fieldIds.filter((id) => id !== f.id) : [...idx.fieldIds, f.id],
                    })
                  }
                >
                  {f.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
