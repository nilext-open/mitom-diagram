import type { Dialect, RefAction } from '../types'

export const DIALECTS: { value: Dialect; label: string }[] = [
  { value: 'generic', label: 'Generic SQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL / MariaDB' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'mssql', label: 'SQL Server' },
]

export const REF_ACTIONS: RefAction[] = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT']

const COMMON = ['INTEGER', 'BIGINT', 'SMALLINT', 'DECIMAL(10,2)', 'FLOAT', 'BOOLEAN', 'CHAR(1)', 'VARCHAR(255)', 'TEXT', 'DATE', 'TIME', 'TIMESTAMP', 'BLOB']

export const DATA_TYPES: Record<Dialect, string[]> = {
  generic: COMMON,
  postgresql: [
    'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL', 'NUMERIC(10,2)', 'REAL', 'DOUBLE PRECISION', 'BOOLEAN',
    'CHAR(1)', 'VARCHAR(255)', 'TEXT', 'UUID', 'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL', 'JSON', 'JSONB',
    'BYTEA', 'INET', 'TEXT[]',
  ],
  mysql: [
    'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL(10,2)', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'CHAR(1)', 'VARCHAR(255)',
    'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'YEAR', 'JSON', 'BLOB', "ENUM('a','b')",
  ],
  sqlite: ['INTEGER', 'REAL', 'NUMERIC', 'TEXT', 'BLOB', 'BOOLEAN', 'DATE', 'DATETIME'],
  mssql: [
    'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL(10,2)', 'FLOAT', 'BIT', 'CHAR(1)', 'NVARCHAR(255)', 'VARCHAR(255)',
    'NVARCHAR(MAX)', 'UNIQUEIDENTIFIER', 'DATE', 'TIME', 'DATETIME2', 'DATETIMEOFFSET', 'VARBINARY(MAX)',
  ],
}

export const DEFAULT_ID_TYPE: Record<Dialect, string> = {
  generic: 'INTEGER',
  postgresql: 'BIGINT',
  mysql: 'INT',
  sqlite: 'INTEGER',
  mssql: 'INT',
}

export const DEFAULT_FIELD_TYPE: Record<Dialect, string> = {
  generic: 'VARCHAR(255)',
  postgresql: 'VARCHAR(255)',
  mysql: 'VARCHAR(255)',
  sqlite: 'TEXT',
  mssql: 'NVARCHAR(255)',
}

export function quoteIdent(name: string, dialect: Dialect): string {
  switch (dialect) {
    case 'mysql':
      return '`' + name.replace(/`/g, '``') + '`'
    case 'mssql':
      return '[' + name.replace(/]/g, ']]') + ']'
    default:
      return '"' + name.replace(/"/g, '""') + '"'
  }
}
