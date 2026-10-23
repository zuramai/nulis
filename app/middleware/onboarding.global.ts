import type { AuthStatus } from '#shared/types'

/**
 * First-run flow: create account → log in → connect GitHub → pick repositories.
 * Each step redirects to the next missing one.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const status = await useRequestFetch()<AuthStatus>('/api/auth/status')
  const path = to.path

  if (!status.hasUser)
    return path === '/setup' ? undefined : navigateTo('/setup')
  if (!status.loggedIn)
    return path === '/login' ? undefined : navigateTo('/login')
  if (path === '/setup' || path === '/login')
    return navigateTo('/')
  if (!status.githubConnected)
    return path === '/connect' || path === '/settings' ? undefined : navigateTo('/connect')
  if (path === '/connect')
    return navigateTo('/connect/repos')
  if (!status.projectCount && !path.startsWith('/connect') && path !== '/settings')
    return navigateTo('/connect/repos')
})
