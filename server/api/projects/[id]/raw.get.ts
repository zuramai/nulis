import { PendingAsset } from '../../../models'
import { extname, isImagePath, resolveImageCandidates } from '../../../utils/content/paths'

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

/**
 * Serves an image referenced from a content file so the editor can preview it, including
 * images in private repositories and uploads that are not committed yet.
 * `?from=<content path>&src=<src as written in markdown>`
 */
export default defineEventHandler(async (event) => {
  const { project, git, ref } = await requireProject(event)
  const { from, src } = getQuery(event)
  if (typeof from !== 'string' || typeof src !== 'string')
    throw createError({ statusCode: 400, statusMessage: 'from and src are required' })

  const candidates = resolveImageCandidates(from, src).filter(isImagePath)
  for (const path of candidates) {
    const pending = await PendingAsset.findOne({ projectId: project._id, path }).lean()
    const content = pending ? Buffer.from(pending.data) : (await git.getFile(ref, path))?.content
    if (!content)
      continue
    setResponseHeaders(event, {
      'Content-Type': MIME[extname(path)] ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=300',
      // SVGs from a repo should never run scripts in our origin
      'Content-Security-Policy': 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox',
      'X-Content-Type-Options': 'nosniff',
    })
    return content
  }
  throw createError({ statusCode: 404, statusMessage: 'Image not found' })
})
