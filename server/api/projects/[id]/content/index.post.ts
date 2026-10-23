import { z } from 'zod'
import { ContentEntry, PendingAsset } from '../../../../models'
import { serializeMarkdown } from '../../../../utils/content/frontmatter'
import { commitOrFail, contentBody, stagedAssets, upsertEntry } from '../../../../utils/content-ops'
import { collectionFor } from '../../../../utils/sync'
import type { ContentCollection } from '#shared/types'

const schema = contentBody.extend({ path: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const { project, git, ref } = await requireProject(event)
  const input = await readValidatedBody(event, schema.parse)
  const collection = collectionFor(project.collections as unknown as ContentCollection[], input.path)
  if (!collection || input.path.split('/').includes('..'))
    throw createError({ statusCode: 400, statusMessage: 'Path is not inside a content collection' })
  if (await ContentEntry.exists({ projectId: project._id, path: input.path }) || await git.getFile(ref, input.path))
    throw createError({ statusCode: 409, statusMessage: `"${input.path}" already exists` })

  const document = serializeMarkdown(input.frontmatter, input.body)
  const assets = await stagedAssets(project, input.assets, document)
  const result = await commitOrFail(git, ref, input.message, [{ path: input.path, content: document }, ...assets.changes])
  await PendingAsset.deleteMany({ _id: { $in: assets.ids } })
  const sha = result.blobs[input.path]!
  await upsertEntry(project, collection, input.path, sha, document)
  setResponseStatus(event, 201)
  return { path: input.path, sha, commitSha: result.commitSha }
})
