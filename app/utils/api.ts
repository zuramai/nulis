import { GITHUB_REAUTH } from '#shared/constants'

function isReauthResponse(body: unknown): boolean {
  if (typeof body !== 'object' || body === null)
    return false
  const data = 'data' in body ? body.data : undefined
  return typeof data === 'object' && data !== null && 'code' in data && data.code === GITHUB_REAUTH
}

/**
 * `$fetch` that reconnects GitHub automatically when the server reports a dead token:
 * runs the OAuth round trip, then returns to the current page.
 */
export const apiFetch = $fetch.create({
  onResponseError({ response }) {
    if (import.meta.server || response.status !== 401 || !isReauthResponse(response._data))
      return
    const target = `${window.location.pathname}${window.location.search}`
    window.location.assign(`/auth/github?redirect=${encodeURIComponent(target)}`)
  },
})
