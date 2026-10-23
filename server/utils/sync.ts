import { createHash } from 'node:crypto'
import type { ContentCollection, ContentTemplate } from '#shared/types'
import { getByPath } from '#shared/utils/object'
import { ContentEntry, type ProjectDoc } from '../models'
import { frontmatterKeys, parseMarkdown } from './content/frontmatter'
import { matchesCollection, slugFromPath } from './content/paths'
import { inferTemplate } from './content/template'
import type { GitProvider, RepoRef, TreeEntry } from './git/provider'
import { DETECTION_INPUTS, detectSsg } from './ssg/detect'

const CONCURRENCY = 8
const DATE_KEYS = ['lastmod', 'updated', 'updatedAt', 'date', 'pubDate', 'publishDate', 'created_at']

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length })
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!)
    }
  }))
  return results
}

export function collectionFor(collections: ContentCollection[], path: string) {
  return collections.find(c => matchesCollection(c, path))
}

export function titleOf(frontmatter: Record<string, unknown>, slug: string) {
  const title = frontmatter.title ?? frontmatter.name
  return typeof title === 'string' && title.trim() ? title.trim() : slug
}

function dateFromFrontmatter(frontmatter: Record<string, unknown>): Date | null {
  for (const key of DATE_KEYS) {
    const value = getByPath(frontmatter, key)
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime()))
        return date
    }
  }
  return null
}

/** Fields stored on a ContentEntry for a parsed file. */
export function entryFields(collection: ContentCollection, path: string, blobSha: string, source: string) {
  const { data } = parseMarkdown(source)
  const slug = slugFromPath(collection, path)
  return {
    collectionName: collection.name,
    path,
    slug,
    title: titleOf(data, slug),
    frontmatter: data,
    frontmatterKeys: frontmatterKeys(data),
    blobSha,
  }
}

function detectionKey(entries: TreeEntry[]) {
  const inputs = entries.filter(e => e.type === 'blob' && DETECTION_INPUTS.test(e.path)).map(e => `${e.path}:${e.sha}`).sort()
  return createHash('sha1').update(inputs.join('\n')).digest('hex')
}

export interface SyncResult {
  added: number
  updated: number
  removed: number
  redetected: boolean
}

/**
 * Brings the ContentEntry index of a project in line with its branch head.
 * Only blobs whose sha changed are downloaded.
 */
export async function syncProject(project: ProjectDoc, git: GitProvider, options: { redetect?: boolean } = {}): Promise<SyncResult> {
  const ref: RepoRef = { owner: project.owner, repo: project.repo, branch: project.branch }
  const tree = await git.getTree(ref)
  const blobs = tree.entries.filter(e => e.type === 'blob')
  const shaByPath = new Map(blobs.map(e => [e.path, e.sha]))
  const textCache = new Map<string, Promise<string>>()
  const readText = (path: string) => {
    const sha = shaByPath.get(path)
    if (!sha)
      return Promise.resolve(null)
    if (!textCache.has(sha))
      textCache.set(sha, git.getBlob(ref, sha).then(b => b.toString('utf8')))
    return textCache.get(sha)!
  }

  // 1. (Re)detect the SSG when it was never done or its config changed
  const key = detectionKey(blobs)
  const redetected = options.redetect || !project.collections.length || project.detectionKey !== key
  let detectedTemplates: ContentTemplate[] | null = null
  if (redetected) {
    const detection = await detectSsg({ paths: blobs.map(b => b.path), read: readText })
    project.ssg = detection.ssg
    project.set('collections', detection.collections)
    detectedTemplates = detection.templates
    project.detectionKey = key
  }
  const collections = project.collections as unknown as ContentCollection[]

  // 2. Diff content files against the index
  const contentFiles = blobs
    .map(b => ({ ...b, collection: collectionFor(collections, b.path) }))
    .filter((b): b is TreeEntry & { collection: ContentCollection } => !!b.collection)
  const existing = new Map((await ContentEntry.find({ projectId: project._id }, { path: 1, blobSha: 1 }).lean()).map(e => [e.path, e.blobSha]))
  const changed = contentFiles.filter(f => existing.get(f.path) !== f.sha)
  const keep = new Set(contentFiles.map(f => f.path))
  const removed = [...existing.keys()].filter(p => !keep.has(p))

  const dates = changed.length ? await git.lastCommitDates(ref, changed.map(f => f.path)) : {}
  const docs = await mapLimit(changed, CONCURRENCY, async (file) => {
    const fields = entryFields(file.collection, file.path, file.sha, (await readText(file.path)) ?? '')
    const date = dates[file.path] ? new Date(dates[file.path]!) : dateFromFrontmatter(fields.frontmatter)
    return { ...fields, updatedAt: date }
  })

  if (docs.length) {
    await ContentEntry.bulkWrite(docs.map(doc => ({
      updateOne: { filter: { projectId: project._id, path: doc.path }, update: { $set: { ...doc, projectId: project._id } }, upsert: true },
    })))
  }
  if (removed.length)
    await ContentEntry.deleteMany({ projectId: project._id, path: { $in: removed } })

  // 3. Templates: detected ones win, otherwise infer from the newest entries
  if (detectedTemplates) {
    let templates = detectedTemplates
    if (!templates.length) {
      const sample = await ContentEntry.find({ projectId: project._id }).sort({ updatedAt: -1 }).limit(20).lean()
      const inferred = inferTemplate(sample.map(e => ({ frontmatter: e.frontmatter as Record<string, unknown> })))
      templates = inferred ? [inferred] : []
    }
    project.set('templates', templates)
  }

  // 4. Project stats
  const [count, newest] = await Promise.all([
    ContentEntry.countDocuments({ projectId: project._id }),
    ContentEntry.findOne({ projectId: project._id, updatedAt: { $ne: null } }).sort({ updatedAt: -1 }).lean(),
  ])
  project.headSha = tree.headSha
  project.postCount = count
  project.lastSyncedAt = new Date()
  project.lastUpdatedAt = newest?.updatedAt ?? null
  await project.save()

  const added = changed.filter(f => !existing.has(f.path)).length
  return { added, updated: changed.length - added, removed: removed.length, redetected }
}
