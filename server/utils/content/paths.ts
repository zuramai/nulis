import { posix } from 'node:path'
import picomatch from 'picomatch'
import type { ContentCollection } from '#shared/types'
import { slugify } from '#shared/utils/object'

export const MARKDOWN_EXTENSIONS = ['md', 'mdx', 'markdown']
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg']

export function isImagePath(path: string) {
  return IMAGE_EXTENSIONS.includes(extname(path))
}

export function extname(path: string) {
  const ext = posix.extname(path)
  return ext ? ext.slice(1).toLowerCase() : ''
}

function relativeToBase(collection: ContentCollection, path: string): string | null {
  const base = collection.baseDir.replace(/\/$/, '')
  if (!base)
    return path
  return path.startsWith(`${base}/`) ? path.slice(base.length + 1) : null
}

/** Does this repo path belong to the collection? */
export function matchesCollection(collection: ContentCollection, path: string): boolean {
  const rel = relativeToBase(collection, path)
  if (rel === null)
    return false
  if (collection.layout === 'bundle') {
    // Only the bundle's leaf file counts, and section indexes (`_index.md`) are not entries
    if (posix.basename(rel) !== (collection.bundleFile ?? 'index.md'))
      return false
    if (!rel.includes('/'))
      return false
  }
  return picomatch(collection.glob, { dot: false, nocase: true })(rel)
}

export function slugFromPath(collection: ContentCollection, path: string): string {
  const rel = relativeToBase(collection, path) ?? path
  if (collection.layout === 'bundle')
    return posix.dirname(rel)
  return rel.replace(/\.[^./]+$/, '')
}

export function pathForSlug(collection: ContentCollection, rawSlug: string): string {
  const slug = rawSlug.split('/').map(slugify).filter(Boolean).join('/')
  if (!slug)
    throw new Error('Slug is empty')
  const base = collection.baseDir.replace(/\/$/, '')
  const file = collection.layout === 'bundle'
    ? `${slug}/${collection.bundleFile ?? 'index.md'}`
    : `${slug}.${collection.extension}`
  return base ? `${base}/${file}` : file
}

/** Directory (repo path) that new images for this content file go to. */
export function imageDirFor(collection: ContentCollection, contentPath: string): string {
  if (collection.layout === 'bundle' || collection.imageDir === '{bundle}')
    return posix.dirname(contentPath)
  return collection.imageDir.replace(/\/$/, '')
}

/** How the markdown file should reference an image stored at `imagePath`. */
export function imageReference(contentPath: string, imagePath: string): string {
  const rel = posix.relative(posix.dirname(contentPath), imagePath)
  return rel.includes('/') || rel.startsWith('.') ? rel : `./${rel}`
}

/** Paths that a delete of `contentPath` should remove (the whole directory for bundles). */
export function ownedPaths(collection: ContentCollection, contentPath: string, allPaths: string[]): string[] {
  if (collection.layout !== 'bundle')
    return [contentPath]
  const dir = `${posix.dirname(contentPath)}/`
  return allPaths.filter(p => p.startsWith(dir))
}

/**
 * Candidate repo paths an image `src` written in `contentPath` may point at.
 * Root-relative sources are looked up in the usual static dirs of each SSG.
 */
export function resolveImageCandidates(contentPath: string, src: string): string[] {
  const clean = decodeURIComponent(src.split(/[?#]/)[0] ?? '')
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean))
    return []
  if (clean.startsWith('/')) {
    const rel = clean.slice(1)
    return [`static/${rel}`, `public/${rel}`, `assets/${rel}`, rel]
  }
  const resolved = posix.normalize(posix.join(posix.dirname(contentPath), clean))
  if (resolved.startsWith('..'))
    return []
  return [resolved]
}

export function uniqueFileName(name: string, taken: Set<string>, dir: string): string {
  const ext = posix.extname(name).toLowerCase()
  const stem = slugify(posix.basename(name, posix.extname(name))) || 'image'
  let candidate = `${stem}${ext}`
  let i = 1
  while (taken.has(dir ? `${dir}/${candidate}` : candidate))
    candidate = `${stem}-${i++}${ext}`
  return candidate
}
