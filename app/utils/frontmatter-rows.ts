import { isPlainObject } from '#shared/utils/object'

export type FieldKind = 'text' | 'number' | 'boolean' | 'list' | 'json'

export interface FieldRow {
  id: number
  key: string
  kind: FieldKind
  value: string | number | boolean | string[]
}

let nextId = 0

function kindOf(value: unknown): FieldKind {
  if (typeof value === 'number')
    return 'number'
  if (typeof value === 'boolean')
    return 'boolean'
  if (Array.isArray(value))
    return value.every(v => ['string', 'number', 'boolean'].includes(typeof v)) ? 'list' : 'json'
  if (value === null || value === undefined || typeof value === 'string')
    return 'text'
  return 'json'
}

/** Nested objects become dotted keys (`camera_settings.iso`) so every leaf gets its own row. */
export function toRows(data: Record<string, unknown>, prefix = ''): FieldRow[] {
  return Object.entries(data).flatMap(([key, value]): FieldRow[] => {
    const path = prefix ? `${prefix}.${key}` : key
    if (isPlainObject(value) && Object.keys(value).length)
      return toRows(value, path)
    const kind = kindOf(value)
    return [{
      id: nextId++,
      key: path,
      kind,
      value: kind === 'list'
        ? (value as unknown[]).map(String)
        : kind === 'json'
          ? JSON.stringify(value, null, 2)
          : kind === 'text'
            ? (value ?? '') as string
            : value as number | boolean,
    }]
  })
}

export function newRow(kind: FieldKind = 'text'): FieldRow {
  return { id: nextId++, key: '', kind, value: emptyValue(kind) }
}

export function emptyValue(kind: FieldKind): FieldRow['value'] {
  return kind === 'list' ? [] : kind === 'boolean' ? false : kind === 'number' ? 0 : ''
}

function parseValue(row: FieldRow): unknown {
  switch (row.kind) {
    case 'number': {
      const n = Number(row.value)
      return Number.isFinite(n) ? n : 0
    }
    case 'boolean':
      return row.value === true || row.value === 'true'
    case 'list':
      return Array.isArray(row.value) ? row.value : []
    case 'json':
      try {
        return JSON.parse(String(row.value))
      }
      catch {
        return String(row.value)
      }
    default:
      return String(row.value ?? '')
  }
}

/** Rebuilds the frontmatter object, re-nesting dotted keys in row order. Rows without a key are skipped. */
export function fromRows(rows: FieldRow[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const row of rows) {
    const parts = row.key.trim().split('.').map(p => p.trim()).filter(Boolean)
    if (!parts.length)
      continue
    let target = result
    for (const part of parts.slice(0, -1)) {
      if (!isPlainObject(target[part]))
        target[part] = {}
      target = target[part] as Record<string, unknown>
    }
    target[parts.at(-1)!] = parseValue(row)
  }
  return result
}

export function invalidJson(row: FieldRow) {
  if (row.kind !== 'json')
    return false
  try {
    JSON.parse(String(row.value))
    return false
  }
  catch {
    return true
  }
}
