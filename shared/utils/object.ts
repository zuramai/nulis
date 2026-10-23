/** Reads a dotted key (`camera_settings.iso`) from a nested object. */
export function getByPath(data: Record<string, unknown> | null | undefined, key: string): unknown {
  let current: unknown = data
  for (const part of key.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current))
      return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
}

/** Turns arbitrary text into a URL/file friendly slug. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
}
