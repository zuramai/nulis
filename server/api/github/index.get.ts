import { GithubConnection } from '../../models'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const connection = await GithubConnection.findOne({ userId: user.id }).lean()
  return connection ? { login: connection.login, avatarUrl: connection.avatarUrl, connectedAt: connection.createdAt } : null
})
