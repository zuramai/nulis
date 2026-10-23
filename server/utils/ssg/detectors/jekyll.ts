import type { Detector } from '../types'
import { firstExisting, groupCollections, hasDir, inferImageDir, readTemplates } from '../helpers'

export const jekyll: Detector = {
  kind: 'jekyll',
  async detect(repo) {
    const { paths } = repo
    if (!firstExisting(paths, ['_config.yml', '_config.yaml']) || !(hasDir(paths, '_posts') || hasDir(paths, '_layouts')))
      return null

    const roots = ['_posts', '_drafts', ...new Set(paths.filter(p => /^_[^/]+\//.test(p)).map(p => p.split('/')[0]!))]
      .filter((dir, i, all) => all.indexOf(dir) === i && !['_layouts', '_includes', '_data', '_sass', '_site', '_plugins'].includes(dir))

    const collections = roots.flatMap(root => groupCollections(paths, root))
    for (const collection of collections) {
      if (collection.layout === 'flat')
        collection.imageDir = await inferImageDir(repo, collection, ['assets/images', 'assets/img', 'images'])
    }
    return { collections, templates: await readTemplates(repo, ['.nulis/templates', '_templates']) }
  },
}
