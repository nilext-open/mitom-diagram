import { produce, type Draft } from 'immer'
import { create } from 'zustand'
import { newField, newNote, newTable, NOTE_COLORS, TABLE_COLORS, uniqueName } from '../lib/model'
import { uid } from '../lib/ids'
import type { Cardinality, DatabaseContent, Diagram, Dialect, Field, Note, Relationship, Selection, Table, TableIndex, Viewport } from '../types'

const HISTORY_LIMIT = 200
const COALESCE_MS = 1200

type Recipe = (c: Draft<DatabaseContent>) => void

export interface EditorState {
  diagram: Diagram | null
  past: DatabaseContent[]
  future: DatabaseContent[]
  /** Bumped on every persisted change (content or name); drives autosave. */
  revision: number
  selection: Selection
  viewport: Viewport
  lastCommit: { key: string; at: number } | null

  load(d: Diagram): void
  rename(name: string): void
  replaceContent(content: DatabaseContent): void
  /** Applies a change and records an undo step. Same `key` within a short window merges into one step. */
  commit(recipe: Recipe, key?: string): void
  /** Applies a change without an undo step (e.g. while dragging, after checkpoint()). */
  mutate(recipe: Recipe): void
  checkpoint(): void
  undo(): void
  redo(): void
  select(s: Selection): void
  setViewport(v: Viewport): void
  setDialect(d: Dialect): void

  addTable(x: number, y: number): string
  updateTable(id: string, patch: Partial<Omit<Table, 'id' | 'fields' | 'indices'>>, key?: string): void
  deleteTable(id: string): void
  duplicateTable(id: string): void
  addField(tableId: string): void
  updateField(tableId: string, fieldId: string, patch: Partial<Omit<Field, 'id'>>, key?: string): void
  deleteField(tableId: string, fieldId: string): void
  moveField(tableId: string, fieldId: string, delta: -1 | 1): void
  addIndex(tableId: string): void
  updateIndex(tableId: string, indexId: string, patch: Partial<Omit<TableIndex, 'id'>>, key?: string): void
  deleteIndex(tableId: string, indexId: string): void
  addRelationship(r: Omit<Relationship, 'id' | 'name' | 'onUpdate' | 'onDelete'>): void
  updateRelationship(id: string, patch: Partial<Omit<Relationship, 'id'>>, key?: string): void
  swapRelationship(id: string): void
  deleteRelationship(id: string): void
  addNote(x: number, y: number): void
  updateNote(id: string, patch: Partial<Omit<Note, 'id'>>, key?: string): void
  deleteNote(id: string): void
  deleteSelection(): void
}

const findTable = (c: Draft<DatabaseContent>, id: string) => c.tables.find((t) => t.id === id)

export const useEditor = create<EditorState>()((set, get) => ({
  diagram: null,
  past: [],
  future: [],
  revision: 0,
  selection: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  lastCommit: null,

  load: (d) => set({ diagram: d, past: [], future: [], revision: 0, selection: null, lastCommit: null }),

  rename: (name) => {
    const d = get().diagram
    if (d) set({ diagram: { ...d, name }, revision: get().revision + 1 })
  },

  replaceContent: (content) => {
    get().commit((c) => {
      Object.assign(c, content)
    })
    set({ selection: null })
  },

  commit: (recipe, key) => {
    const { diagram, past, lastCommit, revision } = get()
    if (!diagram) return
    const next = produce(diagram.content, recipe)
    if (next === diagram.content) return
    const now = Date.now()
    const merge = key !== undefined && lastCommit?.key === key && now - lastCommit.at < COALESCE_MS
    set({
      diagram: { ...diagram, content: next },
      past: merge ? past : [...past, diagram.content].slice(-HISTORY_LIMIT),
      future: [],
      revision: revision + 1,
      lastCommit: key !== undefined ? { key, at: now } : null,
    })
  },

  mutate: (recipe) => {
    const { diagram, revision } = get()
    if (!diagram) return
    const next = produce(diagram.content, recipe)
    if (next !== diagram.content) set({ diagram: { ...diagram, content: next }, revision: revision + 1 })
  },

  checkpoint: () => {
    const { diagram, past } = get()
    if (diagram) set({ past: [...past, diagram.content].slice(-HISTORY_LIMIT), future: [], lastCommit: null })
  },

  undo: () => {
    const { diagram, past, future, revision } = get()
    if (!diagram || past.length === 0) return
    set({
      diagram: { ...diagram, content: past[past.length - 1] },
      past: past.slice(0, -1),
      future: [diagram.content, ...future],
      revision: revision + 1,
      lastCommit: null,
    })
  },

  redo: () => {
    const { diagram, past, future, revision } = get()
    if (!diagram || future.length === 0) return
    set({
      diagram: { ...diagram, content: future[0] },
      past: [...past, diagram.content],
      future: future.slice(1),
      revision: revision + 1,
      lastCommit: null,
    })
  },

  select: (selection) => set({ selection }),
  setViewport: (viewport) => set({ viewport }),
  setDialect: (d) => get().commit((c) => void (c.dialect = d)),

  addTable: (x, y) => {
    const content = get().diagram?.content
    if (!content) return ''
    const t = newTable(
      content.dialect,
      uniqueName('table', content.tables.map((t) => t.name)),
      Math.round(x),
      Math.round(y),
      TABLE_COLORS[content.tables.length % TABLE_COLORS.length],
    )
    get().commit((c) => void c.tables.push(t))
    set({ selection: { kind: 'table', id: t.id } })
    return t.id
  },

  updateTable: (id, patch, key) =>
    get().commit((c) => {
      const t = findTable(c, id)
      if (t) Object.assign(t, patch)
    }, key && `table:${id}:${key}`),

  deleteTable: (id) => {
    get().commit((c) => {
      c.tables = c.tables.filter((t) => t.id !== id)
      c.relationships = c.relationships.filter((r) => r.startTableId !== id && r.endTableId !== id)
    })
    if (get().selection?.id === id) set({ selection: null })
  },

  duplicateTable: (id) => {
    const content = get().diagram?.content
    const src = content?.tables.find((t) => t.id === id)
    if (!content || !src) return
    const idMap = new Map(src.fields.map((f) => [f.id, uid()]))
    const copy: Table = {
      ...structuredClone(src),
      id: uid(),
      name: uniqueName(src.name + '_copy', content.tables.map((t) => t.name)),
      x: src.x + 40,
      y: src.y + 40,
      fields: src.fields.map((f) => ({ ...f, id: idMap.get(f.id)! })),
      indices: src.indices.map((i) => ({ ...i, id: uid(), fieldIds: i.fieldIds.map((f) => idMap.get(f) ?? f) })),
    }
    get().commit((c) => void c.tables.push(copy))
    set({ selection: { kind: 'table', id: copy.id } })
  },

  addField: (tableId) =>
    get().commit((c) => {
      const t = findTable(c, tableId)
      if (t) t.fields.push(newField(c.dialect, { name: uniqueName('column', t.fields.map((f) => f.name)) }))
    }),

  updateField: (tableId, fieldId, patch, key) =>
    get().commit((c) => {
      const f = findTable(c, tableId)?.fields.find((f) => f.id === fieldId)
      if (!f) return
      Object.assign(f, patch)
      if (patch.primary) f.notNull = true
    }, key && `field:${fieldId}:${key}`),

  deleteField: (tableId, fieldId) =>
    get().commit((c) => {
      const t = findTable(c, tableId)
      if (!t) return
      t.fields = t.fields.filter((f) => f.id !== fieldId)
      for (const i of t.indices) i.fieldIds = i.fieldIds.filter((id) => id !== fieldId)
      c.relationships = c.relationships.filter(
        (r) => !(r.startTableId === tableId && r.startFieldId === fieldId) && !(r.endTableId === tableId && r.endFieldId === fieldId),
      )
    }),

  moveField: (tableId, fieldId, delta) =>
    get().commit((c) => {
      const t = findTable(c, tableId)
      if (!t) return
      const i = t.fields.findIndex((f) => f.id === fieldId)
      const j = i + delta
      if (i < 0 || j < 0 || j >= t.fields.length) return
      ;[t.fields[i], t.fields[j]] = [t.fields[j], t.fields[i]]
    }),

  addIndex: (tableId) =>
    get().commit((c) => {
      const t = findTable(c, tableId)
      if (t) t.indices.push({ id: uid(), name: `idx_${t.name}_${t.indices.length + 1}`, fieldIds: [], unique: false })
    }),

  updateIndex: (tableId, indexId, patch, key) =>
    get().commit((c) => {
      const i = findTable(c, tableId)?.indices.find((i) => i.id === indexId)
      if (i) Object.assign(i, patch)
    }, key && `index:${indexId}:${key}`),

  deleteIndex: (tableId, indexId) =>
    get().commit((c) => {
      const t = findTable(c, tableId)
      if (t) t.indices = t.indices.filter((i) => i.id !== indexId)
    }),

  addRelationship: (r) => {
    const content = get().diagram?.content
    if (!content) return
    const same = (x: Relationship) =>
      (x.startTableId === r.startTableId && x.startFieldId === r.startFieldId && x.endTableId === r.endTableId && x.endFieldId === r.endFieldId) ||
      (x.startTableId === r.endTableId && x.startFieldId === r.endFieldId && x.endTableId === r.startTableId && x.endFieldId === r.startFieldId)
    const existing = content.relationships.find(same)
    if (existing) {
      set({ selection: { kind: 'relationship', id: existing.id } })
      return
    }
    const rel: Relationship = { ...r, id: uid(), name: '', onUpdate: 'NO ACTION', onDelete: 'NO ACTION' }
    get().commit((c) => void c.relationships.push(rel))
    set({ selection: { kind: 'relationship', id: rel.id } })
  },

  updateRelationship: (id, patch, key) =>
    get().commit((c) => {
      const r = c.relationships.find((r) => r.id === id)
      if (r) Object.assign(r, patch)
    }, key && `rel:${id}:${key}`),

  swapRelationship: (id) =>
    get().commit((c) => {
      const r = c.relationships.find((r) => r.id === id)
      if (!r) return
      ;[r.startTableId, r.endTableId] = [r.endTableId, r.startTableId]
      ;[r.startFieldId, r.endFieldId] = [r.endFieldId, r.startFieldId]
      const flip: Record<Cardinality, Cardinality> = { one_to_one: 'one_to_one', one_to_many: 'many_to_one', many_to_one: 'one_to_many' }
      r.cardinality = flip[r.cardinality]
    }),

  deleteRelationship: (id) => {
    get().commit((c) => void (c.relationships = c.relationships.filter((r) => r.id !== id)))
    if (get().selection?.id === id) set({ selection: null })
  },

  addNote: (x, y) => {
    const content = get().diagram?.content
    if (!content) return
    const n = newNote(Math.round(x), Math.round(y), NOTE_COLORS[content.notes.length % NOTE_COLORS.length])
    get().commit((c) => void c.notes.push(n))
    set({ selection: { kind: 'note', id: n.id } })
  },

  updateNote: (id, patch, key) =>
    get().commit((c) => {
      const n = c.notes.find((n) => n.id === id)
      if (n) Object.assign(n, patch)
    }, key && `note:${id}:${key}`),

  deleteNote: (id) => {
    get().commit((c) => void (c.notes = c.notes.filter((n) => n.id !== id)))
    if (get().selection?.id === id) set({ selection: null })
  },

  deleteSelection: () => {
    const s = get().selection
    if (!s) return
    if (s.kind === 'table') get().deleteTable(s.id)
    else if (s.kind === 'relationship') get().deleteRelationship(s.id)
    else get().deleteNote(s.id)
  },
}))

export const useContent = () => useEditor((s) => s.diagram?.content)
