import type { ContentTemplate } from '#shared/types'
import { getByPath, isPlainObject } from '#shared/utils/object'
import { parseMarkdown, serializeMarkdown } from './frontmatter'

export interface TemplateContext {
  /** Entry slug, e.g. `my-new-post` */
  name: string
  date?: Date
}

/** RFC 3339 timestamp with the local UTC offset, like Hugo's `.Date`. */
export function formatDate(date: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    + `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
}

function titleCase(input: string) {
  return input.replace(/\b\p{L}/gu, c => c.toUpperCase())
}

type Value = string | Date

const FUNCTIONS: Record<string, (...args: Value[]) => Value> = {
  replace: (input, from, to) => String(input).split(String(from)).join(String(to)),
  title: input => titleCase(String(input)),
  lower: input => String(input).toLowerCase(),
  upper: input => String(input).toUpperCase(),
  humanize: input => {
    const s = String(input).replace(/[-_]+/g, ' ')
    return s.charAt(0).toUpperCase() + s.slice(1)
  },
}

/** Splits a Go template command into tokens, keeping quoted strings intact. */
function tokenize(command: string): string[] {
  return command.match(/"(?:[^"\\]|\\.)*"|`[^`]*`|\S+/g) ?? []
}

/**
 * Evaluates the subset of Go templates used by Hugo archetypes:
 * `.Name`, `.Date`, `.File.ContentBaseName`, `now`, `replace`, `title`, `lower`, `upper`, `humanize`
 * and pipes. Anything else renders as an empty string.
 */
export function renderGoTemplate(source: string, ctx: TemplateContext): string {
  const date = ctx.date ?? new Date()
  const vars: Record<string, Value> = {
    '.Name': ctx.name,
    '.Title': titleCase(ctx.name.replace(/-/g, ' ')),
    '.File.ContentBaseName': ctx.name,
    '.Date': formatDate(date),
    'now': formatDate(date),
  }

  const evalTerm = (token: string): Value => {
    if (/^".*"$/.test(token))
      return JSON.parse(token) as string
    if (/^`.*`$/.test(token))
      return token.slice(1, -1)
    if (token in vars)
      return vars[token]!
    if (/^now\.Format$/.test(token))
      return vars.now!
    return ''
  }

  const evalCommand = (command: string, piped?: Value): Value => {
    const tokens = tokenize(command.trim())
    if (!tokens.length)
      return piped ?? ''
    const [head, ...rest] = tokens
    const fn = FUNCTIONS[head!]
    if (fn) {
      const args = rest.map(evalTerm)
      if (piped !== undefined)
        args.push(piped)
      return fn(...args)
    }
    // `now.Format "2006-01-02"` — keep the ISO timestamp, it is what most SSGs accept
    return evalTerm(head!)
  }

  return source.replace(/\{\{-?\s*([\s\S]*?)\s*-?\}\}/g, (_match, expression: string) => {
    let value: Value | undefined
    for (const part of expression.split('|'))
      value = evalCommand(part, value)
    return String(value ?? '')
  })
}

export function renderTemplate(template: ContentTemplate | undefined, ctx: TemplateContext) {
  if (!template)
    return { frontmatter: {} as Record<string, unknown>, body: '' }
  const parsed = parseMarkdown(renderGoTemplate(template.body, ctx))
  return { frontmatter: parsed.data, body: parsed.body, format: parsed.format, raw: parsed.raw }
}

function blank(value: unknown): unknown {
  if (Array.isArray(value))
    return []
  if (isPlainObject(value))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blank(v)]))
  if (typeof value === 'number')
    return 0
  if (typeof value === 'boolean')
    return false
  return ''
}

/**
 * Builds a template from existing entries: the union of their frontmatter keys,
 * shaped like the newest entry, with values blanked.
 */
export function inferTemplate(entries: { frontmatter: Record<string, unknown> }[], name = 'From existing content'): ContentTemplate | null {
  if (!entries.length)
    return null
  const shape: Record<string, unknown> = {}
  for (const entry of entries) {
    for (const [key, value] of Object.entries(entry.frontmatter)) {
      if (!(key in shape))
        shape[key] = blank(value)
    }
  }
  if (!Object.keys(shape).length)
    return null
  if ('title' in shape)
    shape.title = '{{ replace .Name "-" " " | title }}'
  for (const key of ['date', 'pubDate', 'publishDate', 'created_at']) {
    if (key in shape && typeof getByPath(entries[0]!.frontmatter, key) !== 'object')
      shape[key] = '{{ .Date }}'
  }
  return { name, body: serializeMarkdown(shape, '\n') }
}
