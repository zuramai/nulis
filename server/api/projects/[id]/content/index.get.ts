import { ContentEntry } from '../../../../models'
import { toContentListItem } from '../../../../utils/serialize'

export default defineEventHandler(async (event) => {
  const { project } = await requireProject(event)
  const entries = await ContentEntry.find({ projectId: project._id }).sort({ updatedAt: -1, path: 1 }).lean()
  return entries.map(toContentListItem)
})
