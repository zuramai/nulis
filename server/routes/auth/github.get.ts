import type { H3Event } from 'h3'
import { GithubConnection } from '../../models'
import { encrypt } from '../../utils/crypto'

async function saveConnection(event: H3Event, github: { id: number, login: string, avatar_url?: string }, token: string) {
  const { user } = await requireUserSession(event)
  const { encryptionKey } = useRuntimeConfig(event)
  await GithubConnection.findOneAndUpdate(
    { userId: user.id },
    { userId: user.id, githubId: github.id, login: github.login, avatarUrl: github.avatar_url ?? '', tokenEnc: encrypt(token, encryptionKey) },
    { upsert: true },
  )
  return sendRedirect(event, '/connect/repos')
}

const oauthHandler = defineOAuthGitHubEventHandler({
  async onSuccess(event, { user, tokens }) {
    return saveConnection(event, user, tokens.access_token)
  },
  onError(event, error) {
    console.error('[nulis] GitHub OAuth error:', error)
    return sendRedirect(event, '/connect?error=oauth')
  },
})

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  // Demo / test mode: skip GitHub entirely and connect the in-memory provider
  if (useRuntimeConfig(event).fakeGit)
    return saveConnection(event, { id: 1, login: 'zuramai' }, 'fake-token')
  return oauthHandler(event)
})
