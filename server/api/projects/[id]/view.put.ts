import { z } from 'zod'

const schema = z.object({
  columns: z.array(z.object({
    label: z.string().trim().min(1).max(60),
    key: z.string().trim().min(1).max(200),
    type: z.enum(['text', 'date', 'timestamp', 'tags', 'boolean', 'number']),
  })).max(20),
})

export default defineEventHandler(async (event) => {
  const { project } = await requireProject(event)
  const { columns } = await readValidatedBody(event, schema.parse)
  project.set('view.columns', columns)
  await project.save()
  return { columns }
})
