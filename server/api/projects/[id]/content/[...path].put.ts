import { z } from 'zod'
import { PendingAsset } from '../../../../models'
import { parseMarkdown, serializeMarkdown } from '../../../../utils/content/frontmatter'
import { commitOrFail, contentBody, contentPathParam, stagedAssets, upsertEntry } from '../../../../utils/content-ops'

const schema = contentBody.extend({ sha: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const { project, git, ref } = await requireProject(event)
  const { path, collection } = contentPathParam(event, project)
  const input = await readValidatedBody(event, schema.parse)

  const current = await git.getFile(ref, path)
  if (!current)
    throw createError({ statusCode: 404, statusMessage: 'This content was deleted on GitHub.' })
  if (current.sha !== input.sha)
    throw createError({ statusCode: 409, statusMessage: 'This content changed on GitHub since you opened it. Reload to get the latest version.' })

  // Patch the original frontmatter so comments and formatting of untouched keys survive
  const original = parseMarkdown(current.content.toString('utf8'))
  const document = serializeMarkdown(input.frontmatter, input.body, { format: original.format, raw: original.raw })
  const assets = await stagedAssets(project, input.assets, document)

  const result = await commitOrFail(git, ref, input.message, [{ path, content: document }, ...assets.changes])
  await PendingAsset.deleteMany({ _id: { $in: assets.ids } })
  const sha = result.blobs[path]!
  await upsertEntry(project, collection, path, sha, document)
  return { sha, commitSha: result.commitSha }
})
