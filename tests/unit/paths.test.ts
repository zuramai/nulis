import { describe, expect, it } from 'vitest'
import type { ContentCollection } from '#shared/types'
import {
  imageDirFor,
  imageReference,
  matchesCollection,
  ownedPaths,
  pathForSlug,
  resolveImageCandidates,
  slugFromPath,
  uniqueFileName,
} from '../../server/utils/content/paths'

const bundles: ContentCollection = {
  name: 'content',
  baseDir: 'content',
  layout: 'bundle',
  glob: '*/index.md',
  bundleFile: 'index.md',
  imageDir: '{bundle}',
  extension: 'md',
}

const photos: ContentCollection = {
  name: 'gallery',
  baseDir: 'src/photos',
  layout: 'flat',
  glob: '**/*.{md,mdx}',
  imageDir: 'src/photos/images',
  extension: 'md',
}

describe('collections', () => {
  it('matches bundle leaf files only', () => {
    expect(matchesCollection(bundles, 'content/my-post/index.md')).toBe(true)
    expect(matchesCollection(bundles, 'content/_index.md')).toBe(false)
    expect(matchesCollection(bundles, 'content/my-post/other.md')).toBe(false)
    expect(matchesCollection(bundles, 'static/x/index.md')).toBe(false)
  })

  it('matches flat files with globstar', () => {
    expect(matchesCollection(photos, 'src/photos/1-niagara.md')).toBe(true)
    expect(matchesCollection(photos, 'src/photos/nested/a.mdx')).toBe(true)
    expect(matchesCollection(photos, 'src/photos/images/a.JPG')).toBe(false)
  })

  it('converts between slugs and paths', () => {
    expect(slugFromPath(bundles, 'content/my-post/index.md')).toBe('my-post')
    expect(slugFromPath(photos, 'src/photos/1-niagara.md')).toBe('1-niagara')
    expect(pathForSlug(bundles, 'My New Post!')).toBe('content/my-new-post/index.md')
    expect(pathForSlug(photos, 'sunset')).toBe('src/photos/sunset.md')
    expect(() => pathForSlug(photos, '  ')).toThrow()
  })
})

describe('images', () => {
  it('stores bundle images next to the markdown file', () => {
    const dir = imageDirFor(bundles, 'content/my-post/index.md')
    expect(dir).toBe('content/my-post')
    expect(imageReference('content/my-post/index.md', `${dir}/a.jpg`)).toBe('./a.jpg')
  })

  it('stores flat collection images in the image dir', () => {
    const dir = imageDirFor(photos, 'src/photos/sunset.md')
    expect(dir).toBe('src/photos/images')
    expect(imageReference('src/photos/sunset.md', `${dir}/a.jpg`)).toBe('images/a.jpg')
  })

  it('resolves image sources to repo candidates', () => {
    expect(resolveImageCandidates('content/p/index.md', './a.jpg')).toEqual(['content/p/a.jpg'])
    expect(resolveImageCandidates('src/photos/x.md', 'images/a%20b.JPG')).toEqual(['src/photos/images/a b.JPG'])
    expect(resolveImageCandidates('content/p/index.md', '/images/a.png')).toContain('static/images/a.png')
    expect(resolveImageCandidates('a.md', 'https://x.test/a.png')).toEqual([])
    expect(resolveImageCandidates('a.md', '../../etc/passwd')).toEqual([])
  })

  it('picks unique file names', () => {
    const taken = new Set(['content/p/photo.jpg', 'content/p/photo-1.jpg'])
    expect(uniqueFileName('Photo.JPG', taken, 'content/p')).toBe('photo-2.jpg')
  })

  it('deletes the whole bundle', () => {
    const all = ['content/p/index.md', 'content/p/a.jpg', 'content/q/index.md']
    expect(ownedPaths(bundles, 'content/p/index.md', all)).toEqual(['content/p/index.md', 'content/p/a.jpg'])
    expect(ownedPaths(photos, 'src/photos/a.md', all)).toEqual(['src/photos/a.md'])
  })
})
