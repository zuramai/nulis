import type { ContentCollection, ContentListItem, ContentTemplate, ProjectDetail, ProjectSummary, SsgKind, ViewColumn } from '#shared/types'
import type { ContentEntryFields, ProjectDoc, ProjectFields } from '../models'

export function toProjectSummary(project: ProjectFields): ProjectSummary {
  return {
    id: String(project._id),
    owner: project.owner,
    repo: project.repo,
    branch: project.branch,
    description: project.description ?? '',
    private: !!project.private,
    ssg: project.ssg as SsgKind,
    postCount: project.postCount ?? 0,
    lastSyncedAt: project.lastSyncedAt?.toISOString() ?? null,
    lastUpdatedAt: project.lastUpdatedAt?.toISOString() ?? null,
  }
}

export function toProjectDetail(project: ProjectDoc, frontmatterKeys: string[]): ProjectDetail {
  const plain = project.toObject()
  return {
    ...toProjectSummary(project),
    collections: plain.collections as ContentCollection[],
    templates: (plain.templates as ContentTemplate[]).map(t => ({ name: t.name, path: t.path, body: t.body })),
    view: { columns: (plain.view?.columns ?? []) as ViewColumn[] },
    frontmatterKeys,
  }
}

export function toContentListItem(entry: ContentEntryFields): ContentListItem {
  return {
    path: entry.path,
    slug: entry.slug,
    title: entry.title ?? entry.slug,
    collection: entry.collectionName,
    frontmatter: (entry.frontmatter ?? {}) as Record<string, unknown>,
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
  }
}
