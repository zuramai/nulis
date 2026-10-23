import { z } from 'zod'
import { ContentEntry } from '../../../../models'
import { ownedPaths } from '../../../../utils/content/paths'
import { commitMessage, commitOrFail, contentPathParam } from '../../../../utils/content-ops'

const schema = z.object({ message: commitMessage })

export default defineEventHandler(async (event) => {
  const { project, git, ref } = await requireProject(event)
  const { path, collection } = contentPathParam(event, project)
  const { message } = await readValidatedBody(event, schema.parse)

  const tree = await git.getTree(ref)
  const paths = tree.entries.filter(e => e.type === 'blob').map(e => e.path)
  if (!paths.includes(path))
    throw createError({ statusCode: 404, statusMessage: 'Content not found on GitHub. Try syncing.' })

  // Bundles go away with their images
  const toDelete = ownedPaths(collection, path, paths)
  const result = await commitOrFail(git, ref, message, toDelete.map(p => ({ path: p, content: null })))
  await ContentEntry.deleteOne({ projectId: project._id, path })
  project.postCount = await ContentEntry.countDocuments({ projectId: project._id })
  await project.save()
  return { commitSha: result.commitSha, deleted: toDelete }
})
