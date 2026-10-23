import { PendingAsset } from '../../../models'
import { IMAGE_EXTENSIONS, extname, imageDirFor, imageReference, uniqueFileName } from '../../../utils/content/paths'
import { collectionFor } from '../../../utils/sync'
import type { ContentCollection } from '#shared/types'

const MAX_BYTES = 10 * 1024 * 1024

/**
 * Stages an image for the next commit of `contentPath`. The image is only written to the
 * repository when the content is saved; until then the editor previews it through `/raw`.
 */
export default defineEventHandler(async (event) => {
  const { project, git, ref } = await requireProject(event)
  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file')
  const contentPath = form?.find(part => part.name === 'contentPath')?.data.toString('utf8') ?? ''

  if (!file?.filename || !file.data.length)
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  if (file.data.length > MAX_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'Images must be 10 MB or smaller' })
  if (!file.type?.startsWith('image/') || !IMAGE_EXTENSIONS.includes(extname(file.filename)))
    throw createError({ statusCode: 415, statusMessage: 'Only images can be uploaded' })

  const collection = collectionFor(project.collections as unknown as ContentCollection[], contentPath)
  if (!collection || contentPath.split('/').includes('..'))
    throw createError({ statusCode: 400, statusMessage: 'Unknown content path' })

  const dir = imageDirFor(collection, contentPath)
  const [tree, pending] = await Promise.all([
    git.getTree(ref),
    PendingAsset.find({ projectId: project._id }, { path: 1 }).lean(),
  ])
  const taken = new Set([...tree.entries.map(e => e.path), ...pending.map(p => p.path)])
  const path = `${dir}/${uniqueFileName(file.filename, taken, dir)}`

  const asset = await PendingAsset.create({ projectId: project._id, path, mime: file.type, data: file.data })
  return { id: String(asset._id), path, src: imageReference(contentPath, path) }
})
