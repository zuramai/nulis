import { posix } from 'node:path'
import type { H3Event } from 'h3'
import { z } from 'zod'
import type { ContentCollection } from '#shared/types'
import { ContentEntry, PendingAsset, type ProjectDoc } from '../models'
import type { FileChange, GitProvider, RepoRef } from './git/provider'
import { collectionFor, entryFields } from './sync'

export const commitMessage = z.string().trim().min(1, 'Commit message is required').max(500)

export const contentBody = z.object({
  frontmatter: z.record(z.string(), z.unknown()).default({}),
  body: z.string().max(2_000_000).default(''),
  message: commitMessage,
  assets: z.array(z.string()).max(100).default([]),
})

/** Reads the `[...path]` router param and checks it is a content file of the project. */
export function contentPathParam(event: H3Event, project: ProjectDoc): { path: string, collection: ContentCollection } {
  const raw = getRouterParam(event, 'path') ?? ''
  const path = decodeURIComponent(raw).replace(/^\/+/, '')
  const collection = path && !path.split('/').includes('..') ? collectionFor(project.collections as unknown as ContentCollection[], path) : undefined
  if (!collection)
    throw createError({ statusCode: 404, statusMessage: 'Content not found' })
  return { path, collection }
}

export function findCollection(project: ProjectDoc, name?: string) {
  const collections = project.collections as unknown as ContentCollection[]
  const collection = name ? collections.find(c => c.name === name) : collections[0]
  if (!collection)
    throw createError({ statusCode: 400, statusMessage: 'Unknown collection' })
  return collection
}

/**
 * Turns staged uploads into file changes. Uploads the final document no longer
 * references (removed from the editor before saving) are dropped.
 */
export async function stagedAssets(project: ProjectDoc, ids: string[], document: string) {
  if (!ids.length)
    return { changes: [] as FileChange[], ids: [] as string[] }
  const assets = await PendingAsset.find({ _id: { $in: ids }, projectId: project._id })
  const used = assets.filter(a => document.includes(posix.basename(a.path)))
  return {
    changes: used.map(a => ({ path: a.path, content: Buffer.from(a.data) })),
    ids: assets.map(a => String(a._id)),
  }
}

export async function upsertEntry(project: ProjectDoc, collection: ContentCollection, path: string, blobSha: string, source: string) {
  const fields = entryFields(collection, path, blobSha, source)
  await ContentEntry.updateOne(
    { projectId: project._id, path },
    { $set: { ...fields, projectId: project._id, updatedAt: new Date() } },
    { upsert: true },
  )
  project.lastUpdatedAt = new Date()
  project.postCount = await ContentEntry.countDocuments({ projectId: project._id })
  await project.save()
}

/** Commits, then mirrors the result into the index; maps git errors to HTTP errors. */
export async function commitOrFail(git: GitProvider, ref: RepoRef, message: string, changes: FileChange[]) {
  try {
    return await git.commit(ref, message, changes)
  }
  catch (error) {
    const status = (error as { status?: number }).status
    if (status === 401 || status === 403)
      throw createError({ statusCode: 403, statusMessage: 'GitHub rejected the commit. Check that your token can push to this repository.' })
    if (status === 409 || status === 422)
      throw createError({ statusCode: 409, statusMessage: 'The branch changed on GitHub. Sync and try again.' })
    throw error
  }
}
