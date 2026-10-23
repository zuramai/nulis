import { Project } from '../../models'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const git = await getGitProvider(event, user.id)
  const [repos, existing] = await Promise.all([git.listRepos(), Project.find({ userId: user.id }, { owner: 1, repo: 1 }).lean()])
  const added = new Set(existing.map(p => `${p.owner}/${p.repo}`.toLowerCase()))
  return repos.map(r => ({ ...r, added: added.has(r.fullName.toLowerCase()) }))
})
