import { z } from 'zod'
import { ContentEntry, Project } from '../../models'
import { syncProject } from '../../utils/sync'

const schema = z.object({
  repos: z.array(z.object({ owner: z.string().min(1), repo: z.string().min(1) })).min(1).max(50),
})

interface AddResult {
  fullName: string
  id?: string
  ssg?: string
  postCount?: number
  error?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { repos } = await readValidatedBody(event, schema.parse)
  const git = await getGitProvider(event, user.id)
  const results: AddResult[] = []

  for (const { owner, repo } of repos) {
    const fullName = `${owner}/${repo}`
    if (await Project.exists({ userId: user.id, owner, repo })) {
      results.push({ fullName, error: 'Already added' })
      continue
    }
    let project
    try {
      const info = await git.getRepo(owner, repo)
      project = await Project.create({
        userId: user.id,
        owner,
        repo,
        branch: info.defaultBranch,
        description: info.description,
        private: info.private,
      })
      await syncProject(project, git, { redetect: true })
      results.push({ fullName, id: String(project._id), ssg: project.ssg, postCount: project.postCount })
    }
    catch (error) {
      // Do not leave half-imported projects behind
      if (project) {
        await ContentEntry.deleteMany({ projectId: project._id })
        await project.deleteOne()
      }
      results.push({ fullName, error: (error as Error).message || 'Import failed' })
    }
  }
  return { results }
})
