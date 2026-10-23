import { Types } from 'mongoose'
import { ContentEntry, PendingAsset, Project } from '../../../models'

/** Removes the project from Nulis only. The GitHub repository is not touched. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id || !Types.ObjectId.isValid(id))
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  const project = await Project.findOneAndDelete({ _id: id, userId: user.id })
  if (!project)
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  await Promise.all([
    ContentEntry.deleteMany({ projectId: project._id }),
    PendingAsset.deleteMany({ projectId: project._id }),
  ])
  return { ok: true }
})
