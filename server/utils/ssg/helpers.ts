import { posix } from 'node:path'
import type { ContentCollection, ContentTemplate } from '#shared/types'
import { parseMarkdown } from '../content/frontmatter'
import { MARKDOWN_EXTENSIONS, extname, isImagePath, matchesCollection, resolveImageCandidates } from '../content/paths'
import type { RepoSnapshot } from './types'

const IGNORED_DIRS = ['node_modules/', '.git/', '.github/', 'themes/', 'vendor/', 'dist/', 'public/', 'resources/', '.astro/', '_site/', '.next/', '.nuxt/', '.output/']
const IGNORED_FILES = /^(readme|changelog|license|contributing|code_of_conduct|security|agents|claude)\.(md|mdx|markdown)$/i

export function isMarkdown(path: string) {
  return MARKDOWN_EXTENSIONS.includes(extname(path))
}

export function isIgnored(path: string) {
  return IGNORED_DIRS.some(dir => path.startsWith(dir) || path.includes(`/${dir}`))
}

export function hasDir(paths: string[], dir: string) {
  const prefix = `${dir.replace(/\/$/, '')}/`
  return paths.some(p => p.startsWith(prefix))
}

export function firstExisting(paths: string[], candidates: string[]) {
  const set = new Set(paths)
  return candidates.find(c => set.has(c))
}

/** Content markdown files below `baseDir` (empty string = repository root). */
export function markdownUnder(paths: string[], baseDir: string) {
  const prefix = baseDir ? `${baseDir.replace(/\/$/, '')}/` : ''
  return paths.filter(p => p.startsWith(prefix) && isMarkdown(p) && !isIgnored(p) && !IGNORED_FILES.test(posix.basename(p)))
}

function mostCommonExtension(files: string[]) {
  const counts = new Map<string, number>()
  for (const f of files) counts.set(extname(f), (counts.get(extname(f)) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'md'
}

const BUNDLE_FILES = MARKDOWN_EXTENSIONS.map(ext => `index.${ext}`)

/**
 * Groups markdown files of a content root into collections:
 * bundles (`<dir>/<slug>/index.md`) are grouped by the bundle's parent directory,
 * plain files by their directory.
 */
export function groupCollections(paths: string[], contentRoot: string, options: { flatImageDir?: string } = {}): ContentCollection[] {
  const root = contentRoot.replace(/\/$/, '')
  const files = markdownUnder(paths, root).filter(p => !/^_index\./.test(posix.basename(p)))
  const groups = new Map<string, { bundles: string[], flat: string[] }>()

  for (const file of files) {
    const isBundle = BUNDLE_FILES.includes(posix.basename(file).toLowerCase()) && posix.dirname(file) !== (root || '.')
    const dir = isBundle ? posix.dirname(posix.dirname(file)) : posix.dirname(file)
    const key = dir === '.' ? '' : dir
    const group = groups.get(key) ?? { bundles: [], flat: [] }
    ;(isBundle ? group.bundles : group.flat).push(file)
    groups.set(key, group)
  }

  const collections: (ContentCollection & { count: number })[] = []
  for (const [dir, group] of groups) {
    const rel = root ? posix.relative(root, dir) : dir
    const baseName = rel || posix.basename(root) || 'content'
    const both = group.bundles.length && group.flat.length
    if (group.bundles.length) {
      const bundleFile = posix.basename(group.bundles[0]!)
      collections.push({
        name: both ? `${baseName} (bundles)` : baseName,
        baseDir: dir,
        layout: 'bundle',
        glob: `*/${bundleFile}`,
        bundleFile,
        imageDir: '{bundle}',
        extension: extname(bundleFile),
        count: group.bundles.length,
      })
    }
    if (group.flat.length) {
      const extension = mostCommonExtension(group.flat)
      const exts = [...new Set(group.flat.map(extname))]
      collections.push({
        name: baseName,
        baseDir: dir,
        layout: 'flat',
        glob: exts.length > 1 ? `*.{${exts.join(',')}}` : `*.${extension}`,
        imageDir: options.flatImageDir ?? dir,
        extension,
        count: group.flat.length,
      })
    }
  }
  return collections
    .sort((a, b) => b.count - a.count)
    .map(({ count: _count, ...c }) => c)
}

/** Reads markdown templates (archetypes, scaffolds, `.nulis/templates`) from a directory. */
export async function readTemplates(repo: RepoSnapshot, dirs: string[]): Promise<ContentTemplate[]> {
  const templates: ContentTemplate[] = []
  for (const dir of dirs) {
    const prefix = `${dir}/`
    const files = repo.paths.filter(p => p.startsWith(prefix) && isMarkdown(p)).sort()
    for (const path of files) {
      const rel = path.slice(prefix.length)
      // Bundle archetypes: `archetypes/post/index.md` → "post"
      const name = rel.includes('/') ? rel.split('/')[0]! : rel.replace(/\.[^.]+$/, '')
      if (templates.some(t => t.name === name))
        continue
      const body = await repo.read(path)
      if (body !== null)
        templates.push({ name, path, body })
    }
  }
  return templates
}

const IMAGE_IN_BODY = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g

function collectImageRefs(value: unknown, out: string[]) {
  if (typeof value === 'string') {
    if (isImagePath(value.split(/[?#]/)[0] ?? ''))
      out.push(value)
  }
  else if (Array.isArray(value)) {
    value.forEach(v => collectImageRefs(v, out))
  }
  else if (value && typeof value === 'object') {
    Object.values(value).forEach(v => collectImageRefs(v, out))
  }
}

/**
 * Looks at a sample of entries in a flat collection and returns the directory their
 * images live in (e.g. `src/photos/images`), falling back to conventional folders.
 */
export async function inferImageDir(repo: RepoSnapshot, collection: ContentCollection, fallbacks: string[] = []): Promise<string> {
  const pathSet = new Set(repo.paths)
  const sample = repo.paths.filter(p => matchesCollection(collection, p)).slice(0, 8)
  const counts = new Map<string, number>()

  for (const path of sample) {
    const source = await repo.read(path)
    if (!source)
      continue
    const { data, body } = parseMarkdown(source)
    const refs: string[] = []
    collectImageRefs(data, refs)
    for (const match of body.matchAll(IMAGE_IN_BODY)) refs.push(match[1]!)
    for (const ref of refs) {
      const hit = resolveImageCandidates(path, ref).find(c => pathSet.has(c))
      if (hit)
        counts.set(posix.dirname(hit), (counts.get(posix.dirname(hit)) ?? 0) + 1)
    }
  }

  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (best)
    return best
  const conventional = [`${collection.baseDir}/images`, `${collection.baseDir}/img`, ...fallbacks]
  return conventional.find(dir => repo.paths.some(p => p.startsWith(`${dir}/`) && isImagePath(p))) ?? collection.baseDir
}
