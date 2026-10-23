import type { RepoOption } from '#shared/types'

export interface RepoRef {
  owner: string
  repo: string
  branch: string
}

export interface TreeEntry {
  path: string
  sha: string
  type: 'blob' | 'tree'
  size?: number
}

export interface RepoTree {
  headSha: string
  entries: TreeEntry[]
}

export interface FileChange {
  path: string
  /** New file content. `null` deletes the file. */
  content: Buffer | string | null
}

export interface CommitResult {
  commitSha: string
  /** New blob shas, keyed by path (deleted paths are absent) */
  blobs: Record<string, string>
}

export interface RepoInfo {
  description: string
  private: boolean
  defaultBranch: string
}

/**
 * Everything Nulis needs from a git host. GitHub is the only real implementation for now;
 * the fake provider backs tests and demo mode.
 */
export interface GitProvider {
  listRepos(): Promise<RepoOption[]>
  getRepo(owner: string, repo: string): Promise<RepoInfo>
  getTree(ref: RepoRef): Promise<RepoTree>
  getBlob(ref: RepoRef, sha: string): Promise<Buffer>
  getFile(ref: RepoRef, path: string): Promise<{ sha: string, content: Buffer } | null>
  /** Last commit date per path. Paths that cannot be resolved are omitted. */
  lastCommitDates(ref: RepoRef, paths: string[]): Promise<Record<string, string>>
  /**
   * Commits the changes on top of the current branch head as a single commit.
   * File-level conflict checks are the caller's job (compare blob shas first).
   */
  commit(ref: RepoRef, message: string, changes: FileChange[]): Promise<CommitResult>
}
