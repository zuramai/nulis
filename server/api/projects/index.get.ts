import { Project } from '../../models'
import { toProjectSummary } from '../../utils/serialize'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projects = await Project.find({ userId: user.id }).sort({ createdAt: 1 }).lean()
  return projects.map(toProjectSummary)
})
