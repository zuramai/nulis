import { z } from 'zod'
import { ContentEntry } from '../../../../models'
import { pathForSlug } from '../../../../utils/content/paths'
import { renderTemplate } from '../../../../utils/content/template'
import { findCollection } from '../../../../utils/content-ops'

const schema = z.object({
  collection: z.string().optional(),
  slug: z.string().trim().min(1, 'Slug is required').max(200),
  /** Template name; empty for a blank document */
  template: z.string().optional(),
})

/** Resolves the path for a new entry and renders its template. Nothing is written. */
export default defineEventHandler(async (event) => {
  const { project, git, ref } = await requireProject(event)
  const input = await readValidatedBody(event, schema.parse)
  const collection = findCollection(project, input.collection)

  let path: string
  try {
    path = pathForSlug(collection, input.slug)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Slug must contain letters or numbers' })
  }
  if (await ContentEntry.exists({ projectId: project._id, path }) || await git.getFile(ref, path))
    throw createError({ statusCode: 409, statusMessage: `"${path}" already exists` })

  const template = input.template ? project.templates.find(t => t.name === input.template) : undefined
  if (input.template && !template)
    throw createError({ statusCode: 400, statusMessage: 'Unknown template' })

  const slug = path.split('/').at(collection.layout === 'bundle' ? -2 : -1)!.replace(/\.[^.]+$/, '')
  const rendered = renderTemplate(template ? { name: template.name ?? '', body: template.body ?? '' } : undefined, { name: slug })
  return { path, collection: collection.name, slug, frontmatter: rendered.frontmatter, body: rendered.body }
})
