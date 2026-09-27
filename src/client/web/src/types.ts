export type DiagramKind = 'database' | 'architecture'

export type Dialect = 'generic' | 'postgresql' | 'mysql' | 'sqlite' | 'mssql'

/**
 * Cardinality reads from the start table to the end table. The "many" side
 * holds the foreign key; for one_to_one the start table holds it.
 */
export type Cardinality = 'one_to_one' | 'one_to_many' | 'many_to_one'

export type RefAction = 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT'

export interface Field {
  id: string
  name: string
  /** Full SQL type including size, e.g. VARCHAR(255). */
  type: string
  primary: boolean
  notNull: boolean
  unique: boolean
  increment: boolean
  default: string
  comment: string
}

export interface TableIndex {
  id: string
  name: string
  fieldIds: string[]
  unique: boolean
}

export interface Table {
  id: string
  name: string
  x: number
  y: number
  color: string
  comment: string
  fields: Field[]
  indices: TableIndex[]
}

export interface Relationship {
  id: string
  name: string
  startTableId: string
  startFieldId: string
  endTableId: string
  endFieldId: string
  cardinality: Cardinality
  onUpdate: RefAction
  onDelete: RefAction
}

export interface Note {
  id: string
  x: number
  y: number
  width: number
  title: string
  content: string
  color: string
}

export interface DatabaseContent {
  version: 1
  dialect: Dialect
  tables: Table[]
  relationships: Relationship[]
  notes: Note[]
}

export interface DiagramSummary {
  id: string
  name: string
  kind: DiagramKind
  createdAt: string
  updatedAt: string
}

export interface Diagram extends DiagramSummary {
  content: DatabaseContent
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export type SelectionKind = 'table' | 'relationship' | 'note'
export type Selection = { kind: SelectionKind; id: string } | null
