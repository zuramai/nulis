export type SsgKind = 'hugo' | 'astro' | 'jekyll' | 'eleventy' | 'generic'

/**
 * Where a group of content lives in a repository.
 * - `flat`:   one markdown file per entry, e.g. `src/photos/niagara.md`
 * - `bundle`: one directory per entry, e.g. `content/my-post/index.md`
 */
export interface ContentCollection {
  name: string
  baseDir: string
  layout: 'flat' | 'bundle'
  /** Glob (relative to baseDir) that matches content files */
  glob: string
  /** File name used for bundles (usually `index.md`) */
  bundleFile?: string
  /** Directory new images are written to. For bundles this is `{bundle}` (the entry directory). */
  imageDir: string
  /** Extension used for new entries */
  extension: string
}

export interface ContentTemplate {
  name: string
  /** Source path in the repo (e.g. `archetypes/default.md`), absent for inferred templates */
  path?: string
  body: string
}

export type ColumnType = 'text' | 'date' | 'timestamp' | 'tags' | 'boolean' | 'number'

export interface ViewColumn {
  label: string
  key: string
  type: ColumnType
}

export interface ProjectSummary {
  id: string
  owner: string
  repo: string
  branch: string
  description: string
  private: boolean
  ssg: SsgKind
  postCount: number
  lastSyncedAt: string | null
  lastUpdatedAt: string | null
}

export interface ProjectDetail extends ProjectSummary {
  collections: ContentCollection[]
  templates: ContentTemplate[]
  view: { columns: ViewColumn[] }
  frontmatterKeys: string[]
}

export interface ContentListItem {
  path: string
  slug: string
  title: string
  collection: string
  frontmatter: Record<string, unknown>
  updatedAt: string | null
}

export interface ContentDocument {
  path: string
  slug: string
  collection: string
  sha: string
  frontmatter: Record<string, unknown>
  frontmatterFormat: 'yaml' | 'toml' | 'none'
  body: string
}

export interface AuthStatus {
  hasUser: boolean
  loggedIn: boolean
  githubConnected: boolean
  projectCount: number
}

export interface RepoOption {
  owner: string
  repo: string
  fullName: string
  description: string
  private: boolean
  defaultBranch: string
  pushedAt: string | null
}
