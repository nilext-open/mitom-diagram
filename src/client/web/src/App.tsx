import { useCallback, useEffect, useState } from 'react'
import { Canvas } from './components/canvas/Canvas'
import { OpenDialog } from './components/OpenDialog'
import { Sidebar } from './components/sidebar/Sidebar'
import { SqlDialog } from './components/SqlDialog'
import { Toolbar } from './components/Toolbar'
import { useEditor } from './state/editor'
import { checkDaemon, flushSave, hasUnsavedChanges, openInitial, useSession } from './state/session'
import { useTheme } from './state/theme'

const HEALTH_INTERVAL_MS = 5000

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

export function App() {
  const loaded = useEditor((s) => !!s.diagram)
  const daemon = useSession((s) => s.daemon)
  const theme = useTheme((s) => s.theme)
  const [dialog, setDialog] = useState<'open' | 'sql' | null>(null)
  const [error, setError] = useState('')
  const closeDialog = useCallback(() => setDialog(null), [])

  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(''), 6000)
    return () => clearTimeout(id)
  }, [error])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Wait for the daemon, then open a diagram. Keep polling health afterwards.
  useEffect(() => {
    let cancelled = false
    let started = false
    const tick = async () => {
      const ok = await checkDaemon()
      if (ok && !started && !cancelled) {
        started = true
        openInitial().catch((e) => setError(`Could not open diagram: ${e.message}`))
      }
    }
    void tick()
    const id = setInterval(tick, HEALTH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return
      void flushSave()
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 's') {
        e.preventDefault()
        void flushSave()
        return
      }
      if (mod && key === 'o') {
        e.preventDefault()
        setDialog('open')
        return
      }
      if (isEditable(e.target) || dialog) return
      const ed = useEditor.getState()
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) ed.redo()
        else ed.undo()
      } else if (mod && key === 'y') {
        e.preventDefault()
        ed.redo()
      } else if (mod && key === 'd' && ed.selection?.kind === 'table') {
        e.preventDefault()
        ed.duplicateTable(ed.selection.id)
      } else if (key === 'delete' || key === 'backspace') {
        ed.deleteSelection()
      } else if (key === 'escape') {
        ed.select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  if (!loaded) {
    return (
      <div className="splash">
        <img src="/logo.png" alt="Mitom" />
        <h1>Mitom Diagram</h1>
        {error ? (
          <p className="error-text">{error}</p>
        ) : daemon === 'offline' ? (
          <p>
            Waiting for <code>mitom-daemon</code> on <code>/api</code>… Start it with <code>npm run dev</code> or <code>make run</code>.
          </p>
        ) : (
          <p>Connecting…</p>
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <Toolbar onOpen={() => setDialog('open')} onSql={() => setDialog('sql')} onError={setError} />
      <div className="workspace">
        <Sidebar />
        <main className="stage">
          <Canvas />
          {daemon === 'offline' && <div className="banner">Daemon is offline — changes will be saved when it reconnects.</div>}
          <div className="hint">Drag a column's side dot onto another column to relate · Double-click canvas to add a table · Wheel to zoom</div>
        </main>
      </div>
      {dialog === 'open' && <OpenDialog onClose={closeDialog} onError={setError} />}
      {dialog === 'sql' && <SqlDialog onClose={closeDialog} />}
      {error && (
        <div className="toast" role="alert" onClick={() => setError('')}>
          {error}
        </div>
      )}
    </div>
  )
}
