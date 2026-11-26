import type { H3Event } from 'h3'
import { Types } from 'mongoose'
import { GithubConnection, Project, User } from '../models'
import { decrypt } from './crypto'
import { getFakeGit } from './git/fake'
import { GitHubProvider } from './git/github'
import type { GitProvider } from './git/provider'

declare module '#auth-utils' {
  interface User {
    id: string
    username: string
  }
}

export async function requireUser(event: H3Event) {
  const session = await requireUserSession(event)
  const user = await User.findById(session.user.id).lean()
  if (!user) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Session expired' })
  }
  return { id: String(user._id), username: user.username }
}

interface GithubTokenResponse {
  access_token?: string
  refresh_token?: string
  error?: string
  error_description?: string
}

/** Everything needed to exchange a refresh token, decoupled from the runtime config object. */
interface GithubTokenRefreshConfig {
  encryptionKey: string
  clientId: string
  clientSecret: string
}

const renewals = new Map<string, Promise<string | null>>()

/**
 * Exchanges the stored refresh token for a new access token and saves it. GitHub rotates
 * refresh tokens, so concurrent callers share one exchange per user.
 */
async function renewGithubToken(userId: string, rejectedToken: string, config: GithubTokenRefreshConfig): Promise<string | null> {
  const pending = renewals.get(userId)
  if (pending)
    return pending
  const renewal = exchangeRefreshToken(userId, rejectedToken, config).finally(() => renewals.delete(userId))
  renewals.set(userId, renewal)
  return renewal
}

async function exchangeRefreshToken(userId: string, rejectedToken: string, config: GithubTokenRefreshConfig): Promise<string | null> {
  const connection = await GithubConnection.findOne({ userId }).lean()
  if (!connection?.refreshTokenEnc)
    return null
  const storedToken = decrypt(connection.tokenEnc, config.encryptionKey)
  // Another request refreshed the connection while this one was in flight
  if (storedToken !== rejectedToken)
    return storedToken
  if (!config.clientId || !config.clientSecret)
    return null
  try {
    const tokens = await $fetch<GithubTokenResponse>('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: decrypt(connection.refreshTokenEnc, config.encryptionKey),
      }),
    })
    if (!tokens.access_token) {
      console.warn(`[nulis] GitHub token refresh failed: ${tokens.error_description || tokens.error || 'no token returned'}`)
      return null
    }
    const update: Record<string, string> = { tokenEnc: encrypt(tokens.access_token, config.encryptionKey) }
    // Refresh tokens are single-use; keep the rotated one
    if (tokens.refresh_token)
      update.refreshTokenEnc = encrypt(tokens.refresh_token, config.encryptionKey)
    await GithubConnection.updateOne({ userId }, { $set: update })
    return tokens.access_token
  }
  catch (error) {
    console.warn('[nulis] GitHub token refresh failed:', error instanceof Error ? error.message : error)
    return null
  }
}

export async function getGitProvider(event: H3Event, userId: string): Promise<GitProvider> {
  const config = useRuntimeConfig(event)
  const connection = await GithubConnection.findOne({ userId }).lean()
  if (!connection)
    throw createError({ statusCode: 412, statusMessage: 'Connect GitHub first' })
  if (config.fakeGit)
    return getFakeGit()
  const { encryptionKey, oauth } = config
  const { clientId, clientSecret } = oauth.github
  return new GitHubProvider({
    token: decrypt(connection.tokenEnc, encryptionKey),
    renew: rejectedToken => renewGithubToken(userId, rejectedToken, { encryptionKey, clientId, clientSecret }),
  })
}

/** Loads a project owned by the current user, plus a git provider for it. */
export async function requireProject(event: H3Event) {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id || !Types.ObjectId.isValid(id))
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  const project = await Project.findOne({ _id: id, userId: user.id })
  if (!project)
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  const git = await getGitProvider(event, user.id)
  const ref = { owner: project.owner, repo: project.repo, branch: project.branch }
  return { user, project, git, ref }
}
