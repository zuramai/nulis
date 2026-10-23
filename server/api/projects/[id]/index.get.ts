import { ContentEntry } from '../../../models'
import { toProjectDetail } from '../../../utils/serialize'

export default defineEventHandler(async (event) => {
  const { project } = await requireProject(event)
  const keys = await ContentEntry.distinct('frontmatterKeys', { projectId: project._id })
  return toProjectDetail(project, (keys as string[]).sort())
})
