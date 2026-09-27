import { AlertTriangle, CircleX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DATA_TYPES } from '../../lib/dialects'
import { validate, type Issue } from '../../lib/model'
import { useEditor } from '../../state/editor'
import type { DatabaseContent } from '../../types'
import { NotesPanel } from './NotesPanel'
import { RelationshipsPanel } from './RelationshipsPanel'
import { TablesPanel } from './TablesPanel'
import { Empty } from './ui'

type Tab = 'tables' | 'relationships' | 'notes' | 'issues'

export function Sidebar() {
  const content = useEditor((s) => s.diagram?.content)
  const selection = useEditor((s) => s.selection)
  const [tab, setTab] = useState<Tab>('tables')
  const issues = useMemo(() => (content ? validate(content) : []), [content])

  useEffect(() => {
    if (selection?.kind === 'table') setTab('tables')
    else if (selection?.kind === 'relationship') setTab('relationships')
    else if (selection?.kind === 'note') setTab('notes')
  }, [selection])

  if (!content) return null
  const errors = issues.filter((i) => i.level === 'error').length

  const tabs: { id: Tab; label: string; count: number; alert?: boolean }[] = [
    { id: 'tables', label: 'Tables', count: content.tables.length },
    { id: 'relationships', label: 'Relations', count: content.relationships.length },
    { id: 'notes', label: 'Notes', count: content.notes.length },
    { id: 'issues', label: 'Issues', count: issues.length, alert: errors > 0 },
  ]

  return (
    <aside className="sidebar">
      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            <span className={`count${t.alert ? ' alert' : ''}`}>{t.count}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-body">
        {tab === 'tables' && <TablesPanel />}
        {tab === 'relationships' && <RelationshipsPanel />}
        {tab === 'notes' && <NotesPanel />}
        {tab === 'issues' && <IssuesPanel issues={issues} />}
      </div>
      <TypeLists content={content} />
    </aside>
  )
}

function IssuesPanel({ issues }: { issues: Issue[] }) {
  const select = useEditor((s) => s.select)
  if (issues.length === 0) return <Empty>No issues found. 🎉</Empty>
  return (
    <div className="panel">
      {issues.map((i, n) => (
        <button key={n} className={`issue ${i.level}`} onClick={() => i.target && select(i.target)}>
          {i.level === 'error' ? <CircleX size={15} /> : <AlertTriangle size={15} />}
          <span>{i.message}</span>
        </button>
      ))}
    </div>
  )
}

function TypeLists({ content }: { content: DatabaseContent }) {
  return (
    <datalist id={`types-${content.dialect}`}>
      {DATA_TYPES[content.dialect].map((t) => (
        <option key={t} value={t} />
      ))}
    </datalist>
  )
}
