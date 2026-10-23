import { describe, expect, it } from 'vitest'
import { frontmatterKeys, parseMarkdown, serializeMarkdown } from '../../server/utils/content/frontmatter'
import { loadFixtureFiles } from '../utils/fixtures'

const til = loadFixtureFiles('hugo-til')['content/1927-solvay-conference/index.md']!.toString()
const gallery = loadFixtureFiles('astro-gallery')['src/photos/1-niagara.md']!.toString()

describe('parseMarkdown', () => {
  it('parses YAML frontmatter and keeps timestamps as strings', () => {
    const parsed = parseMarkdown(til)
    expect(parsed.format).toBe('yaml')
    expect(parsed.data).toMatchObject({
      title: '1927 Solvay Conference',
      date: '2025-12-21T05:41:30+07:00',
      draft: false,
      tags: ['History', 'Physics'],
      language: 'en',
    })
    expect(parsed.body.startsWith('\n![solvay conference 1927]')).toBe(true)
  })

  it('parses nested frontmatter', () => {
    const parsed = parseMarkdown(gallery)
    expect(parsed.data.camera_settings).toEqual({ camera: 'X-M5', iso: 100, aperture: 2.8, focal_length: 45 })
    expect(frontmatterKeys(parsed.data)).toContain('camera_settings.iso')
  })

  it('parses TOML frontmatter', () => {
    const parsed = parseMarkdown('+++\ntitle = "Hi"\ntags = ["a"]\n+++\nBody\n')
    expect(parsed).toMatchObject({ format: 'toml', data: { title: 'Hi', tags: ['a'] }, body: 'Body\n' })
  })

  it('handles files without frontmatter', () => {
    expect(parseMarkdown('# Title\n')).toMatchObject({ format: 'none', data: {}, body: '# Title\n' })
  })
})

describe('serializeMarkdown', () => {
  it('round-trips unchanged content byte for byte', () => {
    for (const source of [til, gallery]) {
      const parsed = parseMarkdown(source)
      expect(serializeMarkdown(parsed.data, parsed.body, { format: parsed.format, raw: parsed.raw })).toBe(source)
    }
  })

  it('patches only changed keys and keeps comments and quoting', () => {
    const parsed = parseMarkdown(til)
    const output = serializeMarkdown(
      { ...parsed.data, tags: ['History'], draft: true, author: 'Saugi' },
      parsed.body,
      { format: parsed.format, raw: parsed.raw },
    )
    expect(output).toContain('title: "1927 Solvay Conference"')
    expect(output).toContain('# Author')
    expect(output).toContain('draft: true')
    expect(output).toMatch(/author: Saugi\n---\n/)
    expect(parseMarkdown(output).data.tags).toEqual(['History'])
  })

  it('removes deleted keys', () => {
    const parsed = parseMarkdown(til)
    const { language: _language, ...rest } = parsed.data
    expect(parseMarkdown(serializeMarkdown(rest, parsed.body, { raw: parsed.raw })).data).not.toHaveProperty('language')
  })

  it('writes TOML and plain YAML', () => {
    expect(serializeMarkdown({ title: 'A' }, 'x', { format: 'toml' })).toBe('+++\ntitle = "A"\n+++\nx')
    expect(serializeMarkdown({ title: 'A' }, 'x')).toBe('---\ntitle: A\n---\nx')
    expect(serializeMarkdown({}, 'x', { format: 'none' })).toBe('x')
  })
})
