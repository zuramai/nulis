import { GithubConnection } from '../../models'

/** Disconnects GitHub. Projects stay, but cannot be synced or saved until reconnected. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await GithubConnection.deleteOne({ userId: user.id })
  return { ok: true }
})
