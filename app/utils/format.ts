const dateTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const dateOnly = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

function toDate(value: unknown): Date | null {
  if (value instanceof Date)
    return value
  if (typeof value !== 'string' && typeof value !== 'number')
    return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "27 January 2026 17:03" — the format used in the designs */
export function formatDateTime(value: unknown): string {
  const date = toDate(value)
  return date ? dateTime.format(date).replace(' at ', ' ').replace(',', '') : ''
}

export function formatDate(value: unknown): string {
  const date = toDate(value)
  return date ? dateOnly.format(date) : ''
}

export const SSG_LABELS: Record<string, string> = {
  hugo: 'Hugo',
  astro: 'Astro',
  jekyll: 'Jekyll',
  eleventy: 'Eleventy',
  generic: 'Markdown',
}

/** Extracts a readable message from a `$fetch` error. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const e = error as { data?: { statusMessage?: string, message?: string, data?: { issues?: { message: string }[] } }, statusMessage?: string, message?: string }
  return e?.data?.data?.issues?.[0]?.message ?? e?.data?.statusMessage ?? e?.data?.message ?? e?.statusMessage ?? e?.message ?? fallback
}
