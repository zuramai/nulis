import { fileURLToPath } from 'node:url'
import { fetch as testFetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'
import type { ContentDocument, ContentListItem, ProjectDetail, ProjectSummary } from '#shared/types'
import { parseMarkdown } from '../../server/utils/content/frontmatter'
import { startMongo } from '../utils/mongo'

const mongo = await startMongo()

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  env: {
    NUXT_MONGODB_URI: mongo.getUri('nulis_test'),
    NUXT_FAKE_GIT: 'true',
    NUXT_SESSION_PASSWORD: 'test-session-password-0123456789-abcdef',
    NUXT_ENCRYPTION_KEY: 'test-encryption-key-0123456789-abcdefgh',
  },
})

afterAll(() => mongo.stop())

/** Minimal cookie-aware client for the test server. */
function client() {
  let cookie = ''
  return async function request<T = unknown>(path: string, init: { method?: string, body?: unknown, form?: FormData } = {}) {
    const headers: Record<string, string> = cookie ? { cookie } : {}
    let body: BodyInit | undefined
    if (init.form) {
      body = init.form
    }
    else if (init.body !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(init.body)
    }
    const res = await testFetch(path, { method: init.method ?? 'GET', headers, body, redirect: 'manual' })
    const setCookie = res.headers.getSetCookie?.() ?? []
    for (const c of setCookie) {
      const pair = c.split(';')[0]!
      const name = pair.split('=')[0]
      cookie = [...cookie.split('; ').filter(p => p && !p.startsWith(`${name}=`)), pair].join('; ')
    }
    const text = await res.text()
    let data: unknown = text
    try {
      data = JSON.parse(text)
    }
    catch {}
    return { status: res.status, data: data as T, headers: res.headers }
  }
}

const owner = client()
const stranger = client()

describe('onboarding', () => {
  it('starts with no user', async () => {
    const { data } = await owner('/api/auth/status')
    expect(data).toEqual({ hasUser: false, loggedIn: false, githubConnected: false, projectCount: 0 })
  })

  it('validates registration input', async () => {
    const { status } = await owner('/api/auth/register', { method: 'POST', body: { username: 'ab', password: 'short' } })
    expect(status).toBe(400)
  })

  it('registers the single owner and closes registration', async () => {
    expect((await owner('/api/auth/register', { method: 'POST', body: { username: 'saugi', password: 'password123' } })).status).toBe(200)
    const second = await stranger('/api/auth/register', { method: 'POST', body: { username: 'other', password: 'password123' } })
    expect(second.status).toBe(403)
    expect((await owner('/api/auth/status')).data).toMatchObject({ hasUser: true, loggedIn: true, githubConnected: false })
  })

  it('rejects bad logins and protects the API', async () => {
    expect((await stranger('/api/auth/login', { method: 'POST', body: { username: 'saugi', password: 'nope-nope' } })).status).toBe(401)
    expect((await stranger('/api/projects')).status).toBe(401)
  })

  it('requires GitHub before listing repositories', async () => {
    expect((await owner('/api/github/repos')).status).toBe(412)
  })

  it('connects GitHub (fake provider) and lists repositories', async () => {
    const res = await owner('/auth/github')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/connect/repos')
    const { data } = await owner<{ fullName: string, added: boolean }[]>('/api/github/repos')
    expect(data.map(r => r.fullName)).toEqual(['zuramai/til', 'zuramai/gallery', 'zuramai/jekyll-blog'])
  })
})

let til: ProjectSummary
let gallery: ProjectSummary

describe('projects', () => {
  it('imports repositories, detecting their SSG', async () => {
    const { data } = await owner<{ results: { fullName: string, ssg: string, postCount: number }[] }>('/api/projects', {
      method: 'POST',
      body: { repos: [{ owner: 'zuramai', repo: 'til' }, { owner: 'zuramai', repo: 'gallery' }, { owner: 'zuramai', repo: 'missing' }] },
    })
    expect(data.results).toEqual([
      expect.objectContaining({ fullName: 'zuramai/til', ssg: 'hugo', postCount: 3 }),
      expect.objectContaining({ fullName: 'zuramai/gallery', ssg: 'astro', postCount: 3 }),
      expect.objectContaining({ fullName: 'zuramai/missing', error: expect.any(String) }),
    ])
    const projects = (await owner<ProjectSummary[]>('/api/projects')).data
    expect(projects).toHaveLength(2)
    ;[til, gallery] = projects as [ProjectSummary, ProjectSummary]
  })

  it('does not import the same repository twice', async () => {
    const { data } = await owner<{ results: { error?: string }[] }>('/api/projects', { method: 'POST', body: { repos: [{ owner: 'zuramai', repo: 'til' }] } })
    expect(data.results[0]!.error).toBe('Already added')
  })

  it('exposes collections, templates and frontmatter keys', async () => {
    const { data } = await owner<ProjectDetail>(`/api/projects/${gallery.id}`)
    expect(data.collections[0]).toMatchObject({ baseDir: 'src/photos', imageDir: 'src/photos/images', layout: 'flat' })
    expect(data.frontmatterKeys).toContain('camera_settings.iso')
    expect(data.templates[0]!.name).toBe('From existing content')
  })

  it('lists content', async () => {
    const { data } = await owner<ContentListItem[]>(`/api/projects/${til.id}/content`)
    expect(data.map(e => e.slug).sort()).toEqual(['1927-solvay-conference', '2025', '3m-dalam-debat'])
    expect(data.find(e => e.slug === '2025')!.updatedAt).toEqual(expect.any(String))
  })

  it('persists the table view', async () => {
    const columns = [{ label: 'Tags', key: 'tags', type: 'tags' }, { label: 'ISO', key: 'camera_settings.iso', type: 'number' }]
    expect((await owner(`/api/projects/${til.id}/view`, { method: 'PUT', body: { columns } })).status).toBe(200)
    expect((await owner<ProjectDetail>(`/api/projects/${til.id}`)).data.view.columns).toEqual(columns)
    expect((await owner(`/api/projects/${til.id}/view`, { method: 'PUT', body: { columns: [{ label: '', key: 'x', type: 'bogus' }] } })).status).toBe(400)
  })

  it('does not expose projects to other sessions', async () => {
    expect((await stranger(`/api/projects/${til.id}`)).status).toBe(401)
    expect((await owner('/api/projects/000000000000000000000000')).status).toBe(404)
  })
})

describe('content', () => {
  const docPath = 'content/2025/index.md'

  it('reads a document live from the repository', async () => {
    const { data } = await owner<ContentDocument>(`/api/projects/${til.id}/content/${docPath}`)
    expect(data).toMatchObject({ slug: '2025', frontmatterFormat: 'yaml', frontmatter: { title: '2025', tags: ['Journal'] } })
  })

  it('refuses paths outside content collections', async () => {
    expect((await owner(`/api/projects/${til.id}/content/config.toml`)).status).toBe(404)
    expect((await owner(`/api/projects/${til.id}/content/content/../config.toml`)).status).toBe(404)
  })

  it('saves edits with a staged image in a single commit', async () => {
    const doc = (await owner<ContentDocument>(`/api/projects/${til.id}/content/${docPath}`)).data
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'My Photo.PNG')
    form.append('contentPath', docPath)
    const asset = (await owner<{ id: string, src: string, path: string }>(`/api/projects/${til.id}/assets`, { method: 'POST', form })).data
    expect(asset).toMatchObject({ path: 'content/2025/my-photo.png', src: './my-photo.png' })

    // The staged image previews before it is committed
    const preview = await owner(`/api/projects/${til.id}/raw?from=${docPath}&src=./my-photo.png`)
    expect(preview.status).toBe(200)
    expect(preview.headers.get('content-type')).toBe('image/png')

    const res = await owner<{ sha: string }>(`/api/projects/${til.id}/content/${docPath}`, {
      method: 'PUT',
      body: {
        sha: doc.sha,
        frontmatter: { ...doc.frontmatter, tags: ['Journal', 'Life'] },
        body: `${doc.body}\n![a caption](./my-photo.png)\n`,
        message: 'Update 2025',
        assets: [asset.id],
      },
    })
    expect(res.status).toBe(200)

    const commits = (await owner<{ message: string, changes: { path: string }[] }[]>('/api/__fake/commits')).data
    expect(commits.at(-1)).toMatchObject({ message: 'Update 2025', changes: [{ path: docPath }, { path: 'content/2025/my-photo.png' }] })

    const file = (await owner<{ content: string }>(`/api/__fake/file?repo=zuramai/til&path=${docPath}`)).data
    expect(file.content).toContain('# Author') // comments in frontmatter survive
    expect(file.content).toContain('title: "2025"')
    expect(file.content).toContain('![a caption](./my-photo.png)')
    expect(parseMarkdown(file.content).data.tags).toEqual(['Journal', 'Life'])
  })

  it('rejects a save based on a stale version', async () => {
    const res = await owner(`/api/projects/${til.id}/content/${docPath}`, {
      method: 'PUT',
      body: { sha: 'stale', frontmatter: {}, body: '', message: 'x' },
    })
    expect(res.status).toBe(409)
  })

  it('requires a commit message', async () => {
    const doc = (await owner<ContentDocument>(`/api/projects/${til.id}/content/${docPath}`)).data
    const res = await owner(`/api/projects/${til.id}/content/${docPath}`, { method: 'PUT', body: { sha: doc.sha, frontmatter: {}, body: '', message: '  ' } })
    expect(res.status).toBe(400)
  })

  it('stores gallery images in the configured image directory', async () => {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), 'sunset.jpg')
    form.append('contentPath', 'src/photos/1-niagara.md')
    const asset = (await owner<{ path: string, src: string }>(`/api/projects/${gallery.id}/assets`, { method: 'POST', form })).data
    expect(asset).toMatchObject({ path: 'src/photos/images/sunset.jpg', src: 'images/sunset.jpg' })
  })

  it('rejects non-image uploads', async () => {
    const form = new FormData()
    form.append('file', new Blob(['hi'], { type: 'text/plain' }), 'notes.txt')
    form.append('contentPath', docPath)
    expect((await owner(`/api/projects/${til.id}/assets`, { method: 'POST', form })).status).toBe(415)
  })

  it('creates content from a template', async () => {
    const prepared = await owner<{ path: string, frontmatter: Record<string, unknown> }>(`/api/projects/${til.id}/content/prepare`, {
      method: 'POST',
      body: { slug: 'Benefits Learning Music', template: 'default' },
    })
    expect(prepared.data.path).toBe('content/benefits-learning-music/index.md')
    expect(prepared.data.frontmatter).toMatchObject({ title: 'Benefits Learning Music', draft: true, tags: ['Language'] })

    const created = await owner(`/api/projects/${til.id}/content`, {
      method: 'POST',
      body: { path: prepared.data.path, frontmatter: prepared.data.frontmatter, body: 'Music is good.\n', message: 'Add music post' },
    })
    expect(created.status).toBe(201)
    expect((await owner<ProjectSummary>(`/api/projects/${til.id}`)).data.postCount).toBe(4)

    const again = await owner(`/api/projects/${til.id}/content/prepare`, { method: 'POST', body: { slug: 'benefits-learning-music' } })
    expect(again.status).toBe(409)
  })

  it('deletes a bundle together with its images', async () => {
    const res = await owner<{ deleted: string[] }>(`/api/projects/${til.id}/content/content/1927-solvay-conference/index.md`, {
      method: 'DELETE',
      body: { message: 'Remove solvay' },
    })
    expect(res.data.deleted.sort()).toEqual([
      'content/1927-solvay-conference/1911_Solvay_conference.jpg',
      'content/1927-solvay-conference/Solvay_conference_1927.jpg',
      'content/1927-solvay-conference/index.md',
    ])
    const slugs = (await owner<ContentListItem[]>(`/api/projects/${til.id}/content`)).data.map(e => e.slug)
    expect(slugs).not.toContain('1927-solvay-conference')
  })
})

describe('sync', () => {
  it('picks up content pushed outside Nulis', async () => {
    await owner('/api/__fake/push', {
      method: 'POST',
      body: {
        repo: 'zuramai/til',
        files: {
          'content/new-from-github/index.md': '---\ntitle: From GitHub\n---\nHi\n',
          'content/3m-dalam-debat/index.md': null,
        },
      },
    })
    const { data } = await owner<{ added: number, removed: number, updated: number }>(`/api/projects/${til.id}/sync`, { method: 'POST' })
    expect(data).toMatchObject({ added: 1, removed: 1, updated: 0 })
    const entries = (await owner<ContentListItem[]>(`/api/projects/${til.id}/content`)).data
    expect(entries.find(e => e.slug === 'new-from-github')?.title).toBe('From GitHub')
  })

  it('is a no-op when nothing changed', async () => {
    const { data } = await owner<{ added: number, removed: number, updated: number }>(`/api/projects/${til.id}/sync`, { method: 'POST' })
    expect(data).toMatchObject({ added: 0, removed: 0, updated: 0 })
  })
})

describe('removing a project', () => {
  it('removes it from Nulis without touching the repository', async () => {
    expect((await owner(`/api/projects/${gallery.id}`, { method: 'DELETE' })).status).toBe(200)
    expect((await owner(`/api/projects/${gallery.id}`)).status).toBe(404)
    const file = (await owner<{ content: string } | null>('/api/__fake/file?repo=zuramai/gallery&path=src/photos/1-niagara.md')).data
    expect(file?.content).toContain('Niagara')
    const repos = (await owner<{ fullName: string, added: boolean }[]>('/api/github/repos')).data
    expect(repos.find(r => r.fullName === 'zuramai/gallery')?.added).toBe(false)
  })
})
