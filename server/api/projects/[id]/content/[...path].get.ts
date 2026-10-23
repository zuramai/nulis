import type { ContentDocument } from '#shared/types'
import { parseMarkdown } from '../../../../utils/content/frontmatter'
import { slugFromPath } from '../../../../utils/content/paths'
import { contentPathParam } from '../../../../utils/content-ops'

export default defineEventHandler(async (event): Promise<ContentDocument> => {
  const { project, git, ref } = await requireProject(event)
  const { path, collection } = contentPathParam(event, project)
  const file = await git.getFile(ref, path)
  if (!file)
    throw createError({ statusCode: 404, statusMessage: 'Content not found on GitHub. Try syncing.' })

  const parsed = parseMarkdown(file.content.toString('utf8'))
  return {
    path,
    slug: slugFromPath(collection, path),
    collection: collection.name,
    sha: file.sha,
    frontmatter: parsed.data,
    frontmatterFormat: parsed.format,
    body: parsed.body,
  }
})
