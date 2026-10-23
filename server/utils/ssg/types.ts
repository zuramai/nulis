import type { ContentCollection, ContentTemplate, SsgKind } from '#shared/types'

export interface RepoSnapshot {
  /** All blob paths in the repository */
  paths: string[]
  /** Reads a text file from the repository, `null` when missing */
  read(path: string): Promise<string | null>
}

export interface DetectionResult {
  ssg: SsgKind
  collections: ContentCollection[]
  templates: ContentTemplate[]
}

export interface Detector {
  kind: SsgKind
  /** Returns `null` when the repository is not this SSG */
  detect(repo: RepoSnapshot): Promise<Omit<DetectionResult, 'ssg'> | null>
}
