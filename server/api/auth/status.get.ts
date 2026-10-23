import type { AuthStatus } from '#shared/types'
import { GithubConnection, Project, User } from '../../models'

export default defineEventHandler(async (event): Promise<AuthStatus> => {
  const [hasUser, session] = await Promise.all([User.exists({}), getUserSession(event)])
  const userId = session.user?.id
  const loggedIn = !!userId && !!(await User.exists({ _id: userId }))
  if (!loggedIn)
    return { hasUser: !!hasUser, loggedIn: false, githubConnected: false, projectCount: 0 }

  const [connection, projectCount] = await Promise.all([
    GithubConnection.exists({ userId }),
    Project.countDocuments({ userId }),
  ])
  return { hasUser: true, loggedIn, githubConnected: !!connection, projectCount }
})
