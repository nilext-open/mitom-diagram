import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { NOTE_COLORS } from '../../lib/model'
import { viewCenter } from '../../lib/viewport'
import { useEditor } from '../../state/editor'
import type { Note } from '../../types'
import { Empty, Swatches, useScrollIntoView } from './ui'

const NO_NOTES: Note[] = []

export function NotesPanel() {
  const notes = useEditor((s) => s.diagram?.content.notes ?? NO_NOTES)
  const selection = useEditor((s) => s.selection)
  const add = () => {
    const c = viewCenter()
    useEditor.getState().addNote(c.x - 110, c.y - 40)
  }
  return (
    <div className="panel">
      <div className="panel-toolbar">
        <span className="spacer" />
        <button className="btn primary" onClick={add}>
          <Plus size={14} /> Note
        </button>
      </div>
      {notes.length === 0 && <Empty>No notes yet.</Empty>}
      {notes.map((n) => (
        <NoteItem key={n.id} note={n} open={selection?.kind === 'note' && selection.id === n.id} />
      ))}
    </div>
  )
}

function NoteItem({ note, open }: { note: Note; open: boolean }) {
  const ed = useEditor.getState()
  const ref = useScrollIntoView<HTMLDivElement>(open)
  return (
    <div ref={ref} className={`item${open ? ' open' : ''}`}>
      <button className="item-head" onClick={() => ed.select(open ? null : { kind: 'note', id: note.id })}>
        <span className="dot" style={{ background: note.color }} />
        <span className="item-title">{note.title || <em>untitled</em>}</span>
        <ChevronRight size={14} className="chevron" />
      </button>
      {open && (
        <div className="item-body">
          <label className="field">
            <span>Title</span>
            <input value={note.title} onChange={(e) => ed.updateNote(note.id, { title: e.target.value }, 'title')} />
          </label>
          <label className="field">
            <span>Content</span>
            <textarea rows={5} value={note.content} onChange={(e) => ed.updateNote(note.id, { content: e.target.value }, 'content')} />
          </label>
          <div className="field">
            <span>Colour</span>
            <Swatches colors={NOTE_COLORS} value={note.color} onChange={(color) => ed.updateNote(note.id, { color })} />
          </div>
          <div className="row-actions">
            <span className="spacer" />
            <button className="btn small danger" onClick={() => ed.deleteNote(note.id)}>
              <Trash2 size={13} /> Delete note
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
