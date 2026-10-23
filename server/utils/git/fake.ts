import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { RepoOption } from '#shared/types'
import type { CommitResult, FileChange, GitProvider, RepoInfo, RepoRef, RepoTree } from './provider'

export interface FakeCommit {
  repo: string
  sha: string
  message: string
  changes: { path: string, deleted: boolean }[]
  date: string
}

interface FakeRepo {
  info: RepoInfo
  files: Map<string, Buffer>
  dates: Map<string, string>
  head: string
}

/** Same hash git uses for blobs, so shas look and behave like the real thing. */
export function gitBlobSha(content: Buffer) {
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex')
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const SEED: { owner: string, repo: string, fixture: string, description: string }[] = [
  { owner: 'zuramai', repo: 'til', fixture: 'hugo-til', description: 'Today I Learned — Hugo blog' },
  { owner: 'zuramai', repo: 'gallery', fixture: 'astro-gallery', description: 'Photo gallery built with Astro' },
  { owner: 'zuramai', repo: 'jekyll-blog', fixture: 'jekyll-basic', description: 'An old Jekyll blog' },
]

/**
 * In-memory git host used by tests and `NUXT_FAKE_GIT=true` demo mode.
 * Seeded from `tests/fixtures/repos`.
 */
export class FakeGitProvider implements GitProvider {
  repos = new Map<string, FakeRepo>()
  commits: FakeCommit[] = []
  private counter = 0

  constructor(private fixturesDir = join(process.cwd(), 'tests/fixtures/repos')) {
    this.reset()
  }

  reset() {
    this.repos.clear()
    this.commits = []
    this.counter = 0
    for (const seed of SEED) {
      const root = join(this.fixturesDir, seed.fixture)
      const files = new Map<string, Buffer>()
      if (existsSync(root)) {
        for (const file of walk(root))
          files.set(relative(root, file).split('\\').join('/'), readFileSync(file))
      }
      const dates = new Map([...files.keys()].map((p, i) => [p, new Date(Date.UTC(2026, 0, 27, 10, 3 - i)).toISOString()]))
      this.repos.set(`${seed.owner}/${seed.repo}`, {
        info: { description: seed.description, private: false, defaultBranch: 'main' },
        files,
        dates,
        head: this.nextSha(),
      })
    }
  }

  private nextSha() {
    return createHash('sha1').update(`fake-${++this.counter}`).digest('hex')
  }

  private get(owner: string, repo: string) {
    const found = this.repos.get(`${owner}/${repo}`)
    if (!found)
      throw Object.assign(new Error(`Repository ${owner}/${repo} not found`), { status: 404 })
    return found
  }

  async listRepos(): Promise<RepoOption[]> {
    return [...this.repos.entries()].map(([fullName, r]) => {
      const [owner, repo] = fullName.split('/') as [string, string]
      return { owner, repo, fullName, description: r.info.description, private: r.info.private, defaultBranch: 'main', pushedAt: null }
    })
  }

  async getRepo(owner: string, repo: string) {
    return this.get(owner, repo).info
  }

  async getTree(ref: RepoRef): Promise<RepoTree> {
    const repo = this.get(ref.owner, ref.repo)
    return {
      headSha: repo.head,
      entries: [...repo.files.entries()].map(([path, content]) => ({ path, sha: gitBlobSha(content), type: 'blob' as const, size: content.length })),
    }
  }

  async getBlob(ref: RepoRef, sha: string) {
    const repo = this.get(ref.owner, ref.repo)
    for (const content of repo.files.values()) {
      if (gitBlobSha(content) === sha)
        return content
    }
    throw Object.assign(new Error('Blob not found'), { status: 404 })
  }

  async getFile(ref: RepoRef, path: string) {
    const content = this.get(ref.owner, ref.repo).files.get(path)
    return content ? { sha: gitBlobSha(content), content } : null
  }

  async lastCommitDates(ref: RepoRef, paths: string[]) {
    const repo = this.get(ref.owner, ref.repo)
    return Object.fromEntries(paths.filter(p => repo.dates.has(p)).map(p => [p, repo.dates.get(p)!]))
  }

  async commit(ref: RepoRef, message: string, changes: FileChange[]): Promise<CommitResult> {
    const repo = this.get(ref.owner, ref.repo)
    const blobs: Record<string, string> = {}
    const date = new Date().toISOString()
    for (const change of changes) {
      if (change.content === null) {
        repo.files.delete(change.path)
        repo.dates.delete(change.path)
        continue
      }
      const content = Buffer.isBuffer(change.content) ? change.content : Buffer.from(change.content, 'utf8')
      repo.files.set(change.path, content)
      repo.dates.set(change.path, date)
      blobs[change.path] = gitBlobSha(content)
    }
    repo.head = this.nextSha()
    this.commits.push({
      repo: `${ref.owner}/${ref.repo}`,
      sha: repo.head,
      message,
      changes: changes.map(c => ({ path: c.path, deleted: c.content === null })),
      date,
    })
    return { commitSha: repo.head, blobs }
  }
}

const globalKey = Symbol.for('nulis.fakeGit')

export function getFakeGit(): FakeGitProvider {
  const store = globalThis as unknown as Record<symbol, FakeGitProvider | undefined>
  store[globalKey] ??= new FakeGitProvider()
  return store[globalKey]
}
