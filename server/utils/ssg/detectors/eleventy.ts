import type { Detector } from '../types'
import { firstExisting, groupCollections, inferImageDir, readTemplates } from '../helpers'

const CONFIGS = ['eleventy.config.js', 'eleventy.config.mjs', 'eleventy.config.cjs', 'eleventy.config.ts', '.eleventy.js']

export const eleventy: Detector = {
  kind: 'eleventy',
  async detect(repo) {
    const configPath = firstExisting(repo.paths, CONFIGS)
    if (!configPath)
      return null

    const config = (await repo.read(configPath)) ?? ''
    const input = /\binput\s*:\s*['"`]([^'"`]+)['"`]/.exec(config)?.[1]?.replace(/^\.\/?|\/$/g, '') ?? ''
    const collections = groupCollections(repo.paths, input)
      .filter(c => !/(^|\/)_(includes|data|layouts)(\/|$)/.test(c.baseDir))

    for (const collection of collections) {
      if (collection.layout === 'flat')
        collection.imageDir = await inferImageDir(repo, collection, [`${input ? `${input}/` : ''}img`, `${input ? `${input}/` : ''}images`])
    }
    return { collections, templates: await readTemplates(repo, ['.nulis/templates']) }
  },
}
