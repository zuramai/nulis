import { z } from 'zod'
import { getFakeGit } from '../../utils/git/fake'

const pushSchema = z.object({
  repo: z.string(),
  message: z.string().default('External change'),
  files: z.record(z.string(), z.string().nullable()),
})

/**
 * Test hooks for the in-memory git provider. Only available when NUXT_FAKE_GIT is on:
 * - GET  /api/__fake/commits  → commits made so far
 * - POST /api/__fake/push     → simulate someone pushing to GitHub
 * - POST /api/__fake/reset    → restore the seed repositories
 */
export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).fakeGit)
    throw createError({ statusCode: 404 })

  const fake = getFakeGit()
  const action = getRouterParam(event, 'action')
  const method = event.method

  if (action === 'commits' && method === 'GET')
    return fake.commits
  if (action === 'reset' && method === 'POST') {
    fake.reset()
    return { ok: true }
  }
  if (action === 'push' && method === 'POST') {
    const body = await readValidatedBody(event, pushSchema.parse)
    const [owner, repo] = body.repo.split('/') as [string, string]
    return fake.commit({ owner, repo, branch: 'main' }, body.message, Object.entries(body.files).map(([path, content]) => ({ path, content })))
  }
  if (action === 'file' && method === 'GET') {
    const { repo, path } = getQuery(event) as { repo: string, path: string }
    const [owner, name] = repo.split('/') as [string, string]
    const file = await fake.getFile({ owner, repo: name, branch: 'main' }, path)
    return file ? { sha: file.sha, content: file.content.toString('utf8') } : null
  }
  throw createError({ statusCode: 404 })
})
