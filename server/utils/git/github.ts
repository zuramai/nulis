import { Octokit } from '@octokit/rest'
import type { RepoOption } from '#shared/types'
import type { CommitResult, FileChange, GitProvider, RepoInfo, RepoRef, RepoTree } from './provider'

const DATE_BATCH = 50

function isStatus(error: unknown, status: number) {
  return (error as { status?: number })?.status === status
}

export class GitHubProvider implements GitProvider {
  private octokit: Octokit

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token, userAgent: 'nulis' })
  }

  async listRepos(): Promise<RepoOption[]> {
    const repos = await this.octokit.paginate(this.octokit.repos.listForAuthenticatedUser, {
      per_page: 100,
      sort: 'pushed',
      affiliation: 'owner,collaborator,organization_member',
    })
    return repos
      .filter(r => r.permissions?.push !== false && !r.archived)
      .map(r => ({
        owner: r.owner.login,
        repo: r.name,
        fullName: r.full_name,
        description: r.description ?? '',
        private: r.private,
        defaultBranch: r.default_branch,
        pushedAt: r.pushed_at ?? null,
      }))
  }

  async getRepo(owner: string, repo: string): Promise<RepoInfo> {
    const { data } = await this.octokit.repos.get({ owner, repo })
    return { description: data.description ?? '', private: data.private, defaultBranch: data.default_branch }
  }

  private async headSha(ref: RepoRef) {
    const { data } = await this.octokit.git.getRef({ owner: ref.owner, repo: ref.repo, ref: `heads/${ref.branch}` })
    return data.object.sha
  }

  async getTree(ref: RepoRef): Promise<RepoTree> {
    const headSha = await this.headSha(ref)
    const { data } = await this.octokit.git.getTree({ owner: ref.owner, repo: ref.repo, tree_sha: headSha, recursive: 'true' })
    if (data.truncated)
      console.warn(`[nulis] Tree of ${ref.owner}/${ref.repo} is truncated; some content may be missing`)
    return {
      headSha,
      entries: data.tree
        .filter(e => e.path && e.sha && (e.type === 'blob' || e.type === 'tree'))
        .map(e => ({ path: e.path!, sha: e.sha!, type: e.type as 'blob' | 'tree', size: e.size })),
    }
  }

  async getBlob(ref: RepoRef, sha: string): Promise<Buffer> {
    const { data } = await this.octokit.git.getBlob({ owner: ref.owner, repo: ref.repo, file_sha: sha })
    return Buffer.from(data.content, data.encoding === 'base64' ? 'base64' : 'utf8')
  }

  async getFile(ref: RepoRef, path: string) {
    try {
      const { data } = await this.octokit.repos.getContent({ owner: ref.owner, repo: ref.repo, path, ref: ref.branch })
      if (Array.isArray(data) || data.type !== 'file')
        return null
      // The contents API omits bodies over 1 MB; fall back to the blob API
      const content = data.content
        ? Buffer.from(data.content, 'base64')
        : await this.getBlob(ref, data.sha)
      return { sha: data.sha, content }
    }
    catch (error) {
      if (isStatus(error, 404))
        return null
      throw error
    }
  }

  async lastCommitDates(ref: RepoRef, paths: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {}
    for (let i = 0; i < paths.length; i += DATE_BATCH) {
      const batch = paths.slice(i, i + DATE_BATCH)
      const fields = batch.map((path, j) => `f${j}: history(first: 1, path: ${JSON.stringify(path)}) { nodes { committedDate } }`).join('\n')
      const query = `query($owner: String!, $repo: String!, $ref: String!) {
        repository(owner: $owner, name: $repo) { object(expression: $ref) { ... on Commit { ${fields} } } }
      }`
      try {
        const data = await this.octokit.graphql<{ repository: { object: Record<string, { nodes: { committedDate: string }[] }> | null } }>(
          query,
          { owner: ref.owner, repo: ref.repo, ref: ref.branch },
        )
        const object = data.repository.object ?? {}
        batch.forEach((path, j) => {
          const date = object[`f${j}`]?.nodes[0]?.committedDate
          if (date)
            result[path] = date
        })
      }
      catch (error) {
        console.warn('[nulis] Could not load commit dates:', (error as Error).message)
      }
    }
    return result
  }

  async commit(ref: RepoRef, message: string, changes: FileChange[]): Promise<CommitResult> {
    const { owner, repo } = ref
    for (let attempt = 0; ; attempt++) {
      const parent = await this.headSha(ref)
      const { data: parentCommit } = await this.octokit.git.getCommit({ owner, repo, commit_sha: parent })

      const blobs: Record<string, string> = {}
      const tree = await Promise.all(changes.map(async (change) => {
        if (change.content === null)
          return { path: change.path, mode: '100644' as const, type: 'blob' as const, sha: null }
        const content = Buffer.isBuffer(change.content) ? change.content : Buffer.from(change.content, 'utf8')
        const { data } = await this.octokit.git.createBlob({ owner, repo, content: content.toString('base64'), encoding: 'base64' })
        blobs[change.path] = data.sha
        return { path: change.path, mode: '100644' as const, type: 'blob' as const, sha: data.sha }
      }))

      const { data: newTree } = await this.octokit.git.createTree({ owner, repo, base_tree: parentCommit.tree.sha, tree })
      const { data: commit } = await this.octokit.git.createCommit({ owner, repo, message, tree: newTree.sha, parents: [parent] })
      try {
        await this.octokit.git.updateRef({ owner, repo, ref: `heads/${ref.branch}`, sha: commit.sha })
        return { commitSha: commit.sha, blobs }
      }
      catch (error) {
        // Someone pushed in between; rebuild on the new head (file-level conflicts are checked by the caller)
        if (isStatus(error, 422) && attempt < 2)
          continue
        throw error
      }
    }
  }
}
