import { parse as parseToml } from 'smol-toml'
import { parse as parseYaml } from 'yaml'
import type { Detector } from '../types'
import { firstExisting, groupCollections, hasDir, inferImageDir, readTemplates } from '../helpers'

const HUGO_CONFIGS = ['hugo.toml', 'hugo.yaml', 'hugo.yml', 'hugo.json', 'config/_default/hugo.toml', 'config/_default/config.toml']
const LEGACY_CONFIGS = ['config.toml', 'config.yaml', 'config.yml', 'config.json']

function parseConfig(path: string, source: string): Record<string, unknown> {
  try {
    if (path.endsWith('.toml'))
      return parseToml(source) as Record<string, unknown>
    if (path.endsWith('.json'))
      return JSON.parse(source) as Record<string, unknown>
    return (parseYaml(source) ?? {}) as Record<string, unknown>
  }
  catch {
    return {}
  }
}

export const hugo: Detector = {
  kind: 'hugo',
  async detect(repo) {
    const { paths } = repo
    let configPath = firstExisting(paths, HUGO_CONFIGS)
    if (!configPath) {
      const legacy = firstExisting(paths, LEGACY_CONFIGS)
      // `config.toml` alone is too generic; require a Hugo-shaped tree around it
      if (legacy && (hasDir(paths, 'archetypes') || hasDir(paths, 'layouts') || hasDir(paths, 'themes')) && hasDir(paths, 'content'))
        configPath = legacy
    }
    if (!configPath)
      return null

    const config = parseConfig(configPath, (await repo.read(configPath)) ?? '')
    const contentDir = typeof config.contentDir === 'string' ? config.contentDir.replace(/^\.\/|\/$/g, '') : 'content'
    const flatImageDir = hasDir(paths, 'static/images') ? 'static/images' : 'static'
    const collections = groupCollections(paths, contentDir, { flatImageDir })

    for (const collection of collections) {
      if (collection.layout === 'flat')
        collection.imageDir = await inferImageDir(repo, collection, ['static/images', 'static/img', 'assets/images'])
    }

    const templates = await readTemplates(repo, ['archetypes', '.nulis/templates'])
    return { collections, templates }
  },
}
