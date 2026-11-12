import type { AuthStatus } from '#shared/types'

/**
 * Onboarding flow: register or log in → connect GitHub → pick repositories.
 * Each step redirects to the next missing one. Anonymous visitors land on /register until the
 * first account exists, /login afterwards.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const status = await useRequestFetch()<AuthStatus>('/api/auth/status')
  const path = to.path

  const isAuthPage = path === '/login' || path === '/register'
  if (!status.loggedIn)
    return isAuthPage ? undefined : navigateTo(status.hasUser ? '/login' : '/register')
  if (isAuthPage)
    return navigateTo('/')
  if (!status.githubConnected)
    return path === '/connect' || path === '/settings' ? undefined : navigateTo('/connect')
  if (path === '/connect')
    return navigateTo('/connect/repos')
  if (!status.projectCount && !path.startsWith('/connect') && path !== '/settings')
    return navigateTo('/connect/repos')
})
