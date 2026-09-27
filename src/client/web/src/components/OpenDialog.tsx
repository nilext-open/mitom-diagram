import { Database, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useEditor } from '../state/editor'
import { createDiagram, deleteDiagram, openDiagram } from '../state/session'
import type { DiagramSummary } from '../types'
import { Modal } from './Modal'

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function OpenDialog({ onClose, onError }: { onClose(): void; onError(msg: string): void }) {
  const currentId = useEditor((s) => s.diagram?.id)
  const [list, setList] = useState<DiagramSummary[] | null>(null)

  const refresh = () =>
    api
      .list()
      .then(setList)
      .catch((e) => onError(`Could not load diagrams: ${e.message}`))

  useEffect(() => {
    void refresh()
  }, [])

  const run = (fn: () => Promise<unknown>) => fn().catch((e) => onError(e instanceof Error ? e.message : String(e)))

  return (
    <Modal title="Open diagram" onClose={onClose}>
      <button className="btn primary block" onClick={() => run(() => createDiagram().then(onClose))}>
        <Plus size={14} /> New database diagram
      </button>
      <div className="diagram-list">
        {list === null && <div className="empty">Loading…</div>}
        {list?.length === 0 && <div className="empty">No diagrams saved yet.</div>}
        {list?.map((d) => (
          <div key={d.id} className={`diagram-row${d.id === currentId ? ' current' : ''}`}>
            <button className="diagram-open" onClick={() => run(() => openDiagram(d.id).then(onClose))} disabled={d.kind !== 'database'}>
              <Database size={16} />
              <span className="diagram-name">{d.name}</span>
              <span className="muted small">{d.kind === 'database' ? fmt.format(new Date(d.updatedAt)) : `${d.kind} (coming soon)`}</span>
            </button>
            <button
              className="icon-btn danger"
              title="Delete diagram"
              onClick={() => {
                if (confirm(`Delete "${d.name}"? This cannot be undone.`)) run(() => deleteDiagram(d.id).then(refresh))
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
