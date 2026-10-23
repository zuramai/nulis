import { posix } from 'node:path'
import type { ContentCollection } from '#shared/types'
import type { Detector, RepoSnapshot } from '../types'
import { firstExisting, groupCollections, inferImageDir, isMarkdown, readTemplates } from '../helpers'
import { MARKDOWN_EXTENSIONS, extname, matchesCollection } from '../../content/paths'

const ASTRO_CONFIGS = ['astro.config.mjs', 'astro.config.js', 'astro.config.ts', 'astro.config.mts', 'astro.config.cjs']
const CONTENT_CONFIGS = ['src/content.config.ts', 'src/content.config.js', 'src/content.config.mjs', 'src/content/config.ts', 'src/content/config.js', 'src/content/config.mjs']

interface ParsedCollection {
  name: string
  base?: string
  pattern?: string
}

function stringLiteral(source: string, key: string): string | undefined {
  const match = new RegExp(`\\b${key}\\s*:\\s*(['"\`])([^'"\`]*)\\1`).exec(source)
  return match?.[2]
}

/**
 * Extracts `const x = defineCollection({ loader: glob({ base, pattern }) })` declarations.
 * This is a best-effort static read, not a TypeScript evaluation.
 */
export function parseContentConfig(source: string): ParsedCollection[] {
  const declarations = [...source.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*defineCollection\s*\(/g)]
  const byVariable = new Map<string, ParsedCollection>()

  declarations.forEach((match, i) => {
    const start = match.index! + match[0].length
    const end = declarations[i + 1]?.index ?? source.length
    const block = source.slice(start, end)
    const glob = /glob\s*\(\s*\{([\s\S]*?)\}\s*\)/.exec(block)?.[1]
    byVariable.set(match[1]!, {
      name: match[1]!,
      base: glob ? stringLiteral(glob, 'base') : undefined,
      pattern: glob ? stringLiteral(glob, 'pattern') : undefined,
    })
  })

  // `export const collections = { photos: gallery, blog }` maps public names to variables
  const exported = /export\s+const\s+collections\s*=\s*\{([\s\S]*?)\}/.exec(source)?.[1]
  if (exported) {
    for (const entry of exported.split(',')) {
      const [rawName, rawVar] = entry.split(':').map(s => s?.trim().replace(/['"]/g, ''))
      const variable = rawVar || rawName
      const parsed = variable && byVariable.get(variable)
      if (parsed && rawName)
        parsed.name = rawName
    }
  }
  return [...byVariable.values()]
}

function includesMarkdown(pattern: string) {
  return MARKDOWN_EXTENSIONS.some(ext => pattern.includes(ext)) || /\*\*?\/?\*?$/.test(pattern)
}

async function collectionsFromConfig(repo: RepoSnapshot): Promise<ContentCollection[] | null> {
  const configPath = firstExisting(repo.paths, CONTENT_CONFIGS)
  if (!configPath)
    return null
  const parsed = parseContentConfig((await repo.read(configPath)) ?? '')
  const result: ContentCollection[] = []

  for (const entry of parsed) {
    const pattern = entry.pattern ?? '**/*.{md,mdx}'
    if (!includesMarkdown(pattern))
      continue
    const baseDir = posix.normalize(entry.base ?? `src/content/${entry.name}`).replace(/^\.\//, '').replace(/\/$/, '')
    const files = repo.paths.filter(p => p.startsWith(`${baseDir}/`) && isMarkdown(p))
    if (!files.length)
      continue
    const indexFiles = files.filter(p => /\/index\.(md|mdx)$/.test(p) && posix.dirname(p) !== baseDir)
    const bundled = indexFiles.length > files.length / 2
    const extension = extname(files[0]!) || 'md'
    result.push({
      name: entry.name,
      baseDir,
      layout: bundled ? 'bundle' : 'flat',
      glob: bundled ? `**/index.${extension}` : pattern,
      bundleFile: bundled ? `index.${extension}` : undefined,
      imageDir: bundled ? '{bundle}' : baseDir,
      extension,
    })
  }
  return result
}

export const astro: Detector = {
  kind: 'astro',
  async detect(repo) {
    if (!firstExisting(repo.paths, ASTRO_CONFIGS))
      return null

    let collections = await collectionsFromConfig(repo)
    if (!collections?.length)
      collections = groupCollections(repo.paths, 'src/content')
    if (!collections.length)
      collections = groupCollections(repo.paths, 'src/pages')

    for (const collection of collections) {
      if (collection.layout === 'flat') {
        collection.imageDir = await inferImageDir(repo, collection, ['src/assets/images', 'src/assets', 'public/images'])
        // Glob patterns from the config are relative to `base`; make sure ours still match
        if (!repo.paths.some(p => matchesCollection(collection, p)))
          collection.glob = `**/*.${collection.extension}`
      }
    }

    const templates = await readTemplates(repo, ['.nulis/templates', 'archetypes', 'templates'])
    return { collections, templates }
  },
}
