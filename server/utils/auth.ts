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

export async function getGitProvider(event: H3Event, userId: string): Promise<GitProvider> {
  const config = useRuntimeConfig(event)
  const connection = await GithubConnection.findOne({ userId }).lean()
  if (!connection)
    throw createError({ statusCode: 412, statusMessage: 'Connect GitHub first' })
  if (config.fakeGit)
    return getFakeGit()
  return new GitHubProvider(decrypt(connection.tokenEnc, config.encryptionKey))
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
