import {
  ChevronDown,
  Download,
  FileCode,
  FileJson,
  FolderOpen,
  Image,
  Maximize,
  Moon,
  Plus,
  Redo2,
  StickyNote,
  Sun,
  Table2,
  Upload,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DIALECTS } from '../lib/dialects'
import { exportJSON, exportPNG, exportSVG } from '../lib/exporters'
import { parseImport } from '../lib/model'
import { fitToContent, resetZoom, viewCenter, zoomAt } from '../lib/viewport'
import { useEditor } from '../state/editor'
import { createDiagram, useSession } from '../state/session'
import { PALETTES, useTheme } from '../state/theme'
import type { Dialect } from '../types'

interface Props {
  onOpen(): void
  onSql(): void
  onError(msg: string): void
}

export function Toolbar({ onOpen, onSql, onError }: Props) {
  const diagram = useEditor((s) => s.diagram)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const zoom = useEditor((s) => s.viewport.zoom)
  const { theme, toggle } = useTheme()
  const fileInput = useRef<HTMLInputElement>(null)
  if (!diagram) return null

  const ed = useEditor.getState()
  const bg = PALETTES[theme].background
  const guard = (fn: () => unknown) => async () => {
    try {
      await fn()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    }
  }

  const onImport = async (file: File) => {
    const { name, content } = parseImport(await file.text(), diagram.content.dialect)
    await createDiagram(name ?? file.name.replace(/\.json$/i, ''), content)
  }

  return (
    <header className="toolbar">
      <div className="brand">
        <img src="/logo.png" alt="" />
        <span>Mitom</span>
      </div>
      <input
        className="title-input"
        value={diagram.name}
        aria-label="Diagram name"
        onChange={(e) => ed.rename(e.target.value)}
        onBlur={(e) => !e.target.value.trim() && ed.rename('Untitled diagram')}
      />

      <div className="tb-group">
        <Menu label="File">
          <MenuItem icon={<Plus size={14} />} onClick={guard(() => createDiagram())}>
            New diagram
          </MenuItem>
          <MenuItem icon={<FolderOpen size={14} />} onClick={onOpen} hint="Ctrl+O">
            Open…
          </MenuItem>
          <MenuItem icon={<Upload size={14} />} onClick={() => fileInput.current?.click()}>
            Import JSON (Mitom / drawDB)…
          </MenuItem>
        </Menu>
        <Menu label="Export" icon={<Download size={14} />}>
          <MenuItem icon={<FileCode size={14} />} onClick={onSql}>
            SQL…
          </MenuItem>
          <MenuItem icon={<FileJson size={14} />} onClick={() => exportJSON(diagram)}>
            JSON
          </MenuItem>
          <MenuItem icon={<Image size={14} />} onClick={guard(() => exportPNG(diagram, bg))}>
            PNG image
          </MenuItem>
          <MenuItem icon={<Image size={14} />} onClick={guard(() => exportSVG(diagram, bg))}>
            SVG image
          </MenuItem>
        </Menu>
      </div>

      <div className="tb-group">
        <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={ed.undo}>
          <Undo2 size={16} />
        </button>
        <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={ed.redo}>
          <Redo2 size={16} />
        </button>
      </div>

      <div className="tb-group">
        <button
          className="btn"
          onClick={() => {
            const c = viewCenter()
            ed.addTable(c.x - 100, c.y - 60)
          }}
        >
          <Table2 size={15} /> Table
        </button>
        <button
          className="btn"
          onClick={() => {
            const c = viewCenter()
            ed.addNote(c.x - 110, c.y - 40)
          }}
        >
          <StickyNote size={15} /> Note
        </button>
        <select value={diagram.content.dialect} title="Database" onChange={(e) => ed.setDialect(e.target.value as Dialect)}>
          {DIALECTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <span className="spacer" />

      <div className="tb-group">
        <button className="icon-btn" title="Zoom out" onClick={() => zoomAt(1 / 1.2)}>
          <ZoomOut size={16} />
        </button>
        <button className="zoom-label" title="Reset zoom" onClick={resetZoom}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="icon-btn" title="Zoom in" onClick={() => zoomAt(1.2)}>
          <ZoomIn size={16} />
        </button>
        <button className="icon-btn" title="Fit to screen" onClick={fitToContent}>
          <Maximize size={15} />
        </button>
      </div>

      <SaveIndicator />
      <button className="icon-btn" title="Toggle theme" onClick={toggle}>
        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      </button>

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void guard(() => onImport(f))()
        }}
      />
    </header>
  )
}

function SaveIndicator() {
  const daemon = useSession((s) => s.daemon)
  const save = useSession((s) => s.save)
  const error = useSession((s) => s.saveError)
  const version = useSession((s) => s.daemonVersion)
  const label = daemon === 'offline' ? 'Daemon offline' : { saved: 'Saved', pending: 'Unsaved', saving: 'Saving…', error: 'Save failed' }[save]
  const state = daemon === 'offline' || save === 'error' ? 'bad' : save === 'saved' ? 'ok' : 'busy'
  return (
    <span className={`save-indicator ${state}`} title={error || `mitom-daemon ${version}`}>
      <span className="led" />
      {label}
    </span>
  )
}

function Menu({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <button className={`btn${open ? ' active' : ''}`} onClick={() => setOpen(!open)}>
        {icon}
        {label}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="menu-list" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, hint, onClick, children }: { icon: ReactNode; hint?: string; onClick(): void; children: ReactNode }) {
  return (
    <button className="menu-item" onClick={onClick}>
      {icon}
      <span>{children}</span>
      {hint && <kbd>{hint}</kbd>}
    </button>
  )
}
