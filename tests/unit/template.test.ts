import { describe, expect, it } from 'vitest'
import { formatDate, inferTemplate, renderGoTemplate, renderTemplate } from '../../server/utils/content/template'
import { loadFixtureFiles } from '../utils/fixtures'

const date = new Date('2026-01-27T10:03:00Z')

describe('renderGoTemplate', () => {
  it('renders the Hugo default archetype', () => {
    const archetype = loadFixtureFiles('hugo-til')['archetypes/default.md']!.toString()
    const result = renderTemplate({ name: 'default', body: archetype }, { name: 'benefits-learning-music', date })
    expect(result.frontmatter).toMatchObject({
      title: 'Benefits Learning Music',
      date: formatDate(date),
      draft: true,
      tags: ['Language'],
      language: 'de',
    })
  })

  it('supports pipes, functions and string literals', () => {
    expect(renderGoTemplate('{{ .Name | upper }}', { name: 'a-b' })).toBe('A-B')
    expect(renderGoTemplate('{{ humanize .Name }}', { name: 'a-b' })).toBe('A b')
    expect(renderGoTemplate('{{ "x" }}{{ .Unknown }}', { name: 'a' })).toBe('x')
  })

  it('formats dates like Hugo', () => {
    expect(formatDate(date)).toMatch(/^2026-01-2\dT\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/)
  })
})

describe('inferTemplate', () => {
  it('blanks values and templatizes title/date', () => {
    const template = inferTemplate([
      { frontmatter: { title: 'A', tags: ['x'], camera_settings: { iso: 100, camera: 'X' }, date: '2020-01-01' } },
      { frontmatter: { title: 'B', location: 'Bandung' } },
    ])!
    const rendered = renderTemplate(template, { name: 'my-photo', date })
    expect(rendered.frontmatter).toEqual({
      title: 'My Photo',
      tags: [],
      camera_settings: { iso: 0, camera: '' },
      date: formatDate(date),
      location: '',
    })
  })

  it('returns null without entries', () => {
    expect(inferTemplate([])).toBeNull()
  })
})
