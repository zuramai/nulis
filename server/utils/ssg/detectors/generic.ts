import type { Detector } from '../types'
import { groupCollections, inferImageDir, readTemplates } from '../helpers'

/** Fallback: treat the directories holding markdown as collections, biggest first. */
export const generic: Detector = {
  kind: 'generic',
  async detect(repo) {
    const collections = groupCollections(repo.paths, '')
      // A lone root README-style folder is rarely content; keep the meaningful ones
      .filter(c => c.baseDir !== '' || repo.paths.filter(p => !p.includes('/')).length > 3)
      .slice(0, 5)

    for (const collection of collections) {
      if (collection.layout === 'flat')
        collection.imageDir = await inferImageDir(repo, collection, ['images', 'assets/images', 'static/images', 'public/images'])
    }
    return { collections, templates: await readTemplates(repo, ['.nulis/templates', 'archetypes', 'scaffolds']) }
  },
}
