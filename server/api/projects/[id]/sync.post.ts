import { toProjectSummary } from '../../../utils/serialize'
import { syncProject } from '../../../utils/sync'

export default defineEventHandler(async (event) => {
  const { project, git } = await requireProject(event)
  const { redetect } = getQuery(event)
  const result = await syncProject(project, git, { redetect: redetect === 'true' || redetect === '1' })
  return { ...result, project: toProjectSummary(project) }
})
