import type { Cardinality, DatabaseContent, Dialect, Field, Note, RefAction, Relationship, Table, TableIndex } from '../types'
import { DEFAULT_FIELD_TYPE, DEFAULT_ID_TYPE, REF_ACTIONS } from './dialects'
import { uid } from './ids'

export const TABLE_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#eab308', '#06b6d4', '#ec4899', '#64748b']
export const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#e9d5ff', '#fed7aa']

export function emptyContent(dialect: Dialect = 'postgresql'): DatabaseContent {
  return { version: 1, dialect, tables: [], relationships: [], notes: [] }
}

export function newField(dialect: Dialect, patch: Partial<Field> = {}): Field {
  return {
    id: uid(),
    name: 'column',
    type: DEFAULT_FIELD_TYPE[dialect],
    primary: false,
    notNull: false,
    unique: false,
    increment: false,
    default: '',
    comment: '',
    ...patch,
  }
}

export function newTable(dialect: Dialect, name: string, x: number, y: number, color: string): Table {
  return {
    id: uid(),
    name,
    x,
    y,
    color,
    comment: '',
    fields: [newField(dialect, { name: 'id', type: DEFAULT_ID_TYPE[dialect], primary: true, notNull: true, increment: true })],
    indices: [],
  }
}

export function newNote(x: number, y: number, color: string): Note {
  return { id: uid(), x, y, width: 220, title: 'Note', content: '', color }
}

export function uniqueName(base: string, taken: Iterable<string>): string {
  const set = new Set(Array.from(taken, (n) => n.toLowerCase()))
  if (!set.has(base.toLowerCase())) return base
  for (let i = 2; ; i++) {
    const candidate = `${base}_${i}`
    if (!set.has(candidate.toLowerCase())) return candidate
  }
}

// ---------------------------------------------------------------------------
// Import normalisation. Accepts our own format and drawDB JSON exports, and
// fills in defaults so older or hand-written files never crash the editor.
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : d)
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const bool = (v: unknown): boolean => v === true
const id = (v: unknown): string => (v === undefined || v === null || v === '' ? uid() : String(v))

const DIALECT_ALIASES: Record<string, Dialect> = {
  generic: 'generic',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  mysql: 'mysql',
  mariadb: 'mysql',
  sqlite: 'sqlite',
  mssql: 'mssql',
  transactsql: 'mssql',
}

function normCardinality(v: unknown): Cardinality {
  const s = str(v).toLowerCase().replace(/[\s-]+/g, '_')
  if (s === 'one_to_one' || s === 'one_to_many' || s === 'many_to_one') return s
  return 'many_to_one'
}

function normAction(v: unknown): RefAction {
  const s = str(v).toUpperCase().replace(/_/g, ' ').trim()
  return (REF_ACTIONS as string[]).includes(s) ? (s as RefAction) : 'NO ACTION'
}

function normField(raw: unknown): Field {
  const f = obj(raw)
  let type = str(f.type, 'TEXT')
  // drawDB keeps size / enum values separately from the base type.
  const size = str(f.size)
  if (size && !type.includes('(')) type = `${type}(${size})`
  const values = arr(f.values).map((v) => `'${str(v).replace(/'/g, "''")}'`)
  if (values.length && !type.includes('(')) type = `${type}(${values.join(',')})`
  return {
    id: id(f.id),
    name: str(f.name, 'column'),
    type,
    primary: bool(f.primary),
    notNull: bool(f.notNull),
    unique: bool(f.unique),
    increment: bool(f.increment),
    default: str(f.default),
    comment: str(f.comment),
  }
}

function normIndex(raw: unknown, fields: Field[]): TableIndex {
  const i = obj(raw)
  // drawDB stores index columns by field name.
  const fieldIds = arr(i.fieldIds ?? i.fields)
    .map((ref) => {
      const s = str(ref)
      return fields.find((f) => f.id === s)?.id ?? fields.find((f) => f.name === s)?.id
    })
    .filter((v): v is string => !!v)
  return { id: id(i.id), name: str(i.name), fieldIds, unique: bool(i.unique) }
}

function normTable(raw: unknown, index: number): Table {
  const t = obj(raw)
  const fields = arr(t.fields).map(normField)
  return {
    id: id(t.id),
    name: str(t.name, `table_${index + 1}`),
    x: num(t.x, 60 + index * 40),
    y: num(t.y, 60 + index * 40),
    color: str(t.color, TABLE_COLORS[index % TABLE_COLORS.length]),
    comment: str(t.comment),
    fields,
    indices: arr(t.indices).map((i) => normIndex(i, fields)),
  }
}

function normRelationship(raw: unknown): Relationship {
  const r = obj(raw)
  return {
    id: id(r.id),
    name: str(r.name),
    startTableId: str(r.startTableId),
    startFieldId: str(r.startFieldId),
    endTableId: str(r.endTableId),
    endFieldId: str(r.endFieldId),
    cardinality: normCardinality(r.cardinality),
    onUpdate: normAction(r.onUpdate ?? r.updateConstraint),
    onDelete: normAction(r.onDelete ?? r.deleteConstraint),
  }
}

function normNote(raw: unknown, index: number): Note {
  const n = obj(raw)
  return {
    id: id(n.id),
    x: num(n.x, 40 + index * 20),
    y: num(n.y, 40 + index * 20),
    width: Math.max(140, num(n.width, 220)),
    title: str(n.title, 'Note'),
    content: str(n.content),
    color: str(n.color, NOTE_COLORS[0]),
  }
}

export function normalizeContent(raw: unknown, fallbackDialect: Dialect = 'postgresql'): DatabaseContent {
  const c = obj(raw)
  const dialect = DIALECT_ALIASES[str(c.dialect ?? c.database).toLowerCase()] ?? fallbackDialect
  const tables = arr(c.tables).map(normTable)
  const tableById = new Map(tables.map((t) => [t.id, t]))
  const hasField = (tableId: string, fieldId: string) => !!tableById.get(tableId)?.fields.some((f) => f.id === fieldId)
  const relationships = arr(c.relationships ?? c.references)
    .map(normRelationship)
    .filter((r) => hasField(r.startTableId, r.startFieldId) && hasField(r.endTableId, r.endFieldId))
  return { version: 1, dialect, tables, relationships, notes: arr(c.notes).map(normNote) }
}

/** Accepts a full exported diagram ({name, content}) or bare content. */
export function parseImport(text: string, fallbackDialect: Dialect): { name?: string; content: DatabaseContent } {
  const data = obj(JSON.parse(text))
  if (data.content && typeof data.content === 'object') {
    return { name: str(data.name) || undefined, content: normalizeContent(data.content, fallbackDialect) }
  }
  if (!Array.isArray(data.tables)) throw new Error('File does not look like a diagram: missing "tables".')
  return { name: str(data.title) || undefined, content: normalizeContent(data, fallbackDialect) }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface Issue {
  level: 'error' | 'warning'
  message: string
  target?: { kind: 'table' | 'relationship'; id: string }
}

const baseType = (t: string) => t.toUpperCase().replace(/\(.*\)/, '').trim()

export function validate(content: DatabaseContent): Issue[] {
  const issues: Issue[] = []
  const seenTables = new Map<string, number>()
  for (const t of content.tables) {
    const target = { kind: 'table' as const, id: t.id }
    const key = t.name.trim().toLowerCase()
    if (!key) issues.push({ level: 'error', message: 'A table has an empty name', target })
    else seenTables.set(key, (seenTables.get(key) ?? 0) + 1)
    if (t.fields.length === 0) issues.push({ level: 'error', message: `Table "${t.name}" has no columns`, target })
    else if (!t.fields.some((f) => f.primary)) issues.push({ level: 'warning', message: `Table "${t.name}" has no primary key`, target })

    const seenFields = new Set<string>()
    for (const f of t.fields) {
      const fk = f.name.trim().toLowerCase()
      if (!fk) issues.push({ level: 'error', message: `Table "${t.name}" has a column with an empty name`, target })
      else if (seenFields.has(fk)) issues.push({ level: 'error', message: `Duplicate column "${f.name}" in table "${t.name}"`, target })
      seenFields.add(fk)
      if (!f.type.trim()) issues.push({ level: 'error', message: `Column "${t.name}.${f.name}" has no type`, target })
    }
  }
  for (const [name, count] of seenTables) {
    if (count > 1) {
      const t = content.tables.find((x) => x.name.trim().toLowerCase() === name)
      issues.push({ level: 'error', message: `Duplicate table name "${t?.name}"`, target: t && { kind: 'table', id: t.id } })
    }
  }

  const tables = new Map(content.tables.map((t) => [t.id, t]))
  for (const r of content.relationships) {
    const target = { kind: 'relationship' as const, id: r.id }
    const a = tables.get(r.startTableId)?.fields.find((f) => f.id === r.startFieldId)
    const b = tables.get(r.endTableId)?.fields.find((f) => f.id === r.endFieldId)
    if (!a || !b) {
      issues.push({ level: 'error', message: 'A relationship references a missing column', target })
      continue
    }
    const ta = baseType(a.type).replace('SERIAL', 'INT')
    const tb = baseType(b.type).replace('SERIAL', 'INT')
    if (ta !== tb) {
      issues.push({ level: 'warning', message: `Type mismatch in relationship: ${a.name} (${a.type}) vs ${b.name} (${b.type})`, target })
    }
    if ((r.onDelete === 'SET NULL' || r.onUpdate === 'SET NULL') && (a.notNull || b.notNull)) {
      const holder = r.cardinality === 'one_to_many' ? b : a
      if (holder.notNull) issues.push({ level: 'warning', message: `SET NULL on NOT NULL column "${holder.name}"`, target })
    }
  }
  return issues
}
