import type { H3Event } from 'h3'
import { GithubConnection } from '../../models'
import { encrypt } from '../../utils/crypto'

interface GithubTokens {
  access_token: string
  refresh_token?: string
}

interface GithubUser {
  id: number
  login: string
  avatar_url?: string
}

const RETURN_COOKIE = 'nulis_oauth_return'

/** Only follow same-origin paths, never `//host` or backslash tricks. */
function returnPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return undefined
  return value
}

async function saveConnection(event: H3Event, github: GithubUser, tokens: GithubTokens) {
  const { user } = await requireUserSession(event)
  const { encryptionKey } = useRuntimeConfig(event)
  await GithubConnection.findOneAndUpdate(
    { userId: user.id },
    {
      userId: user.id,
      githubId: github.id,
      login: github.login,
      avatarUrl: github.avatar_url ?? '',
      tokenEnc: encrypt(tokens.access_token, encryptionKey),
      refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token, encryptionKey) : null,
    },
    { upsert: true },
  )
  // Set when the reconnect was started automatically by a failed request
  const target = returnPath(getCookie(event, RETURN_COOKIE)) ?? '/connect/repos'
  deleteCookie(event, RETURN_COOKIE, { path: '/' })
  return sendRedirect(event, target)
}

const oauthHandler = defineOAuthGitHubEventHandler({
  async onSuccess(event, { user, tokens }) {
    return saveConnection(event, user, tokens)
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
    return saveConnection(event, { id: 1, login: 'zuramai' }, { access_token: 'fake-token' })

  const query = getQuery(event)
  if (!query.code) {
    const redirect = returnPath(query.redirect)
    if (redirect) {
      setCookie(event, RETURN_COOKIE, redirect, {
        httpOnly: true,
        sameSite: 'lax',
        secure: getRequestURL(event, { xForwardedProto: true }).protocol === 'https:',
        maxAge: 60 * 10,
        path: '/',
      })
    }
  }
  return oauthHandler(event)
})
