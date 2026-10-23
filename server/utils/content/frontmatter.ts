import { isDeepStrictEqual } from 'node:util'
import { parseDocument, stringify as stringifyYaml } from 'yaml'
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml'

export type FrontmatterFormat = 'yaml' | 'toml' | 'none'

export interface ParsedMarkdown {
  format: FrontmatterFormat
  /** Raw frontmatter source between the fences (without fences) */
  raw: string
  data: Record<string, unknown>
  body: string
}

const FENCES: Record<Exclude<FrontmatterFormat, 'none'>, string> = { yaml: '---', toml: '+++' }

function splitFrontmatter(source: string): { format: FrontmatterFormat, raw: string, body: string } {
  const text = source.replace(/^﻿/, '')
  for (const [format, fence] of Object.entries(FENCES) as [Exclude<FrontmatterFormat, 'none'>, string][]) {
    if (!text.startsWith(`${fence}\n`) && !text.startsWith(`${fence}\r\n`))
      continue
    const start = text.indexOf('\n') + 1
    const close = new RegExp(`^${fence.replace(/[+]/g, '\\+')}[ \\t]*$`, 'm')
    const rest = text.slice(start)
    const match = close.exec(rest)
    if (!match)
      continue
    const raw = rest.slice(0, match.index)
    let body = rest.slice(match.index + match[0].length)
    if (body.startsWith('\r\n'))
      body = body.slice(2)
    else if (body.startsWith('\n'))
      body = body.slice(1)
    return { format, raw, body }
  }
  return { format: 'none', raw: '', body: text }
}

function toPlain(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  return {}
}

export function parseMarkdown(source: string): ParsedMarkdown {
  const { format, raw, body } = splitFrontmatter(source)
  if (format === 'yaml')
    return { format, raw, body, data: toPlain(parseDocument(raw).toJS()) }
  if (format === 'toml')
    return { format, raw, body, data: toPlain(parseToml(raw)) }
  return { format, raw, body, data: {} }
}

/**
 * Applies `data` onto the original YAML source so comments, quoting and key order of
 * untouched keys survive the round trip. New keys are appended at the end.
 */
function patchYaml(raw: string, data: Record<string, unknown>): string {
  const doc = parseDocument(raw)
  const previous = toPlain(doc.toJS())
  if (isDeepStrictEqual(previous, data))
    return raw
  if (!doc.contents)
    return stringifyYaml(data)
  for (const key of Object.keys(previous)) {
    if (!(key in data))
      doc.delete(key)
  }
  for (const [key, value] of Object.entries(data)) {
    if (!isDeepStrictEqual(previous[key], value))
      doc.set(key, doc.createNode(value))
  }
  return doc.toString()
}

export function serializeMarkdown(
  data: Record<string, unknown>,
  body: string,
  options: { format?: FrontmatterFormat, raw?: string } = {},
): string {
  const format = options.format === 'none' && Object.keys(data).length ? 'yaml' : (options.format ?? 'yaml')
  if (format === 'none')
    return body

  let frontmatter: string
  if (format === 'toml') {
    frontmatter = stringifyToml(data)
  }
  else {
    frontmatter = options.raw ? patchYaml(options.raw, data) : (Object.keys(data).length ? stringifyYaml(data) : '')
  }
  if (frontmatter && !frontmatter.endsWith('\n'))
    frontmatter += '\n'
  const fence = FENCES[format]
  return `${fence}\n${frontmatter}${fence}\n${body}`
}

/** Flattens nested objects into dotted keys: `{ a: { b: 1 } }` -> `['a.b']` */
export function frontmatterKeys(data: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value))
      keys.push(...frontmatterKeys(value as Record<string, unknown>, path))
    else
      keys.push(path)
  }
  return keys
}
