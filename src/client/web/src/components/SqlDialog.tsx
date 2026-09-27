import { Check, Copy, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DIALECTS } from '../lib/dialects'
import { download, safeFilename } from '../lib/exporters'
import { generateSQL } from '../lib/sql'
import { useEditor } from '../state/editor'
import type { Dialect } from '../types'
import { Modal } from './Modal'

export function SqlDialog({ onClose }: { onClose(): void }) {
  const diagram = useEditor((s) => s.diagram)
  const [dialect, setDialect] = useState<Dialect>(diagram?.content.dialect ?? 'postgresql')
  const [copied, setCopied] = useState(false)
  const sql = useMemo(() => (diagram ? generateSQL(diagram.content, dialect) : ''), [diagram, dialect])
  if (!diagram) return null

  const copy = async () => {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Modal title="Export SQL" onClose={onClose} wide>
      <div className="dialog-toolbar">
        <select value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)}>
          {DIALECTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <button className="btn" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
        </button>
        <button className="btn primary" onClick={() => download(`${safeFilename(diagram.name)}.${dialect}.sql`, sql, 'application/sql')}>
          <Download size={14} /> Download .sql
        </button>
      </div>
      <pre className="code">{sql}</pre>
    </Modal>
  )
}
