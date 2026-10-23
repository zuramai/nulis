import { describe, expect, it } from 'vitest'
import { detectSsg } from '../../server/utils/ssg/detect'
import { parseContentConfig } from '../../server/utils/ssg/detectors/astro'
import { fixtureSnapshot } from '../utils/fixtures'

describe('detectSsg', () => {
  it('detects the til repo as Hugo page bundles with co-located images', async () => {
    const result = await detectSsg(fixtureSnapshot('hugo-til'))
    expect(result.ssg).toBe('hugo')
    expect(result.collections).toHaveLength(1)
    expect(result.collections[0]).toMatchObject({
      baseDir: 'content',
      layout: 'bundle',
      glob: '*/index.md',
      bundleFile: 'index.md',
      imageDir: '{bundle}',
    })
    expect(result.templates.map(t => t.name)).toEqual(['default'])
    expect(result.templates[0]!.body).toContain('{{ replace .Name "-" " " | title }}')
  })

  it('detects the gallery repo as Astro flat files with images in src/photos/images', async () => {
    const result = await detectSsg(fixtureSnapshot('astro-gallery'))
    expect(result.ssg).toBe('astro')
    expect(result.collections).toEqual([
      expect.objectContaining({
        name: 'gallery',
        baseDir: 'src/photos',
        layout: 'flat',
        glob: '**/*.{md,mdx}',
        imageDir: 'src/photos/images',
        extension: 'md',
      }),
    ])
  })

  it('detects Jekyll posts and their image folder', async () => {
    const result = await detectSsg(fixtureSnapshot('jekyll-basic'))
    expect(result.ssg).toBe('jekyll')
    expect(result.collections[0]).toMatchObject({ baseDir: '_posts', layout: 'flat', imageDir: 'assets/images' })
  })

  it('falls back to the folder with the most markdown', async () => {
    const files: Record<string, string> = {
      'README.md': '# hi',
      'notes/a.md': 'a',
      'notes/b.md': 'b',
      'notes/c.md': 'c',
      'docs/x.md': 'x',
    }
    const result = await detectSsg({ paths: Object.keys(files), read: async p => files[p] ?? null })
    expect(result.ssg).toBe('generic')
    expect(result.collections[0]).toMatchObject({ baseDir: 'notes', layout: 'flat' })
    expect(result.collections.some(c => c.baseDir === '')).toBe(false)
  })
})

describe('parseContentConfig', () => {
  it('reads glob loaders and maps exported collection names', () => {
    const source = `
      const posts = defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/data/blog' }) })
      const authors = defineCollection({ loader: glob({ pattern: '**/*.json', base: 'src/data/authors' }) })
      const legacy = defineCollection({ type: 'content' })
      export const collections = { blog: posts, authors, legacy }
    `
    expect(parseContentConfig(source)).toEqual([
      { name: 'blog', base: './src/data/blog', pattern: '**/*.md' },
      { name: 'authors', base: 'src/data/authors', pattern: '**/*.json' },
      { name: 'legacy', base: undefined, pattern: undefined },
    ])
  })
})
