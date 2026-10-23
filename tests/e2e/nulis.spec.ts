import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const USER = { username: 'saugi', password: 'password123' }

interface FakeCommit { message: string, changes: { path: string, deleted: boolean }[] }

async function commits(page: Page): Promise<FakeCommit[]> {
  return (await page.request.get('/api/__fake/commits')).json()
}

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.getByTestId('username').fill(USER.username)
  await page.getByTestId('password').fill(USER.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/projects')
}

async function commitWith(page: Page, message: string) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByTestId('commit-message').fill(message)
  await dialog.getByTestId('commit-submit').click()
}

test('first run: create account, connect GitHub and pick repositories', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page).toHaveURL(/\/setup$/)

  await page.getByTestId('username').fill(USER.username)
  await page.getByTestId('password').fill(USER.password)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/connect$/)
  await page.getByTestId('connect-github').click()
  await expect(page).toHaveURL(/\/connect\/repos$/)

  await page.getByTestId('repo-zuramai/til').click()
  await page.getByTestId('repo-zuramai/gallery').click()
  await page.getByTestId('add-selected').click()

  const results = page.getByTestId('import-results')
  await expect(results).toContainText('zuramai/til')
  await expect(results).toContainText('Hugo · 3 entries')
  await expect(results).toContainText('Astro · 3 entries')

  await page.getByRole('link', { name: 'Go to projects' }).click()
  await expect(page.getByTestId('project-til')).toContainText('Hugo')
  await expect(page.getByTestId('project-gallery')).toContainText('Astro')
})

test('registration is closed and the setup page redirects to login', async ({ page }) => {
  await page.goto('/setup')
  await expect(page).toHaveURL(/\/login$/)
})

test('project page: list, search, sync and edit the table view', async ({ page }) => {
  await login(page)
  await page.getByTestId('project-gallery').getByRole('link').click()

  await expect(page.getByTestId('project-title')).toHaveText('gallery')
  await expect(page.getByTestId('content-row')).toHaveCount(3)

  await page.getByTestId('search').fill('niagara')
  await expect(page.getByTestId('content-row')).toHaveCount(1)
  await page.getByTestId('search').fill('')

  // A push made on GitHub shows up after syncing
  await page.request.post('/api/__fake/push', {
    data: { repo: 'zuramai/gallery', files: { 'src/photos/9-new.md': '---\ntitle: New photo\n---\n' } },
  })
  await page.getByTestId('sync').click()
  await expect(page.getByText('1 new, 0 updated, 0 removed', { exact: true })).toBeVisible()
  await expect(page.getByTestId('content-row')).toHaveCount(4)

  // Add a "Location" column; the photo without that key shows an empty cell
  await page.getByTestId('edit-view').click()
  await page.getByTestId('add-column').click()
  const row = page.getByTestId('column-row-0')
  await row.getByRole('textbox', { name: 'Column name' }).fill('Location')
  await row.getByRole('button', { name: 'Frontmatter key' }).click()
  await page.getByRole('option', { name: 'location', exact: true }).click()
  await page.getByTestId('save-view').click()

  await expect(page.getByRole('columnheader', { name: 'Location' })).toBeVisible()
  const cells = page.getByTestId('cell-location')
  await expect(cells).toHaveCount(4)
  await expect(cells.filter({ hasText: 'Niagara Falls' })).toHaveCount(1)
  await expect(page.getByTestId('content-row').filter({ hasText: '9-new' }).getByTestId('cell-location')).toHaveText('')

  // The view is persisted
  await page.reload()
  await expect(page.getByRole('columnheader', { name: 'Location' })).toBeVisible()
})

test('create content from a template', async ({ page }) => {
  await login(page)
  await page.getByTestId('project-til').getByRole('link').click()
  await page.getByTestId('new-content').click()

  await page.getByTestId('new-title').fill('Benefits Learning Music')
  await expect(page.getByTestId('template-preview')).toContainText('title:')
  await page.getByTestId('continue').click()

  await expect(page.getByTestId('content-title')).toHaveText('benefits-learning-music')
  await page.getByTestId('frontmatter-toggle').click()
  await expect(page.getByTestId('fm-row-title').getByRole('textbox', { name: 'Value' })).toHaveValue('Benefits Learning Music')

  await page.locator('.milkdown .ProseMirror').click()
  await page.keyboard.type('Learning music trains the brain.')
  await page.getByTestId('save').click()
  await commitWith(page, 'Add music post')

  await expect(page.getByText('Changes pushed', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/edit\/content\/benefits-learning-music\/index\.md$/)
  const last = (await commits(page)).at(-1)!
  expect(last.message).toBe('Add music post')
  expect(last.changes.map(c => c.path)).toEqual(['content/benefits-learning-music/index.md'])
})

test('edit frontmatter and body, upload an image and save with a commit message', async ({ page }) => {
  await login(page)
  await page.getByTestId('project-til').getByRole('link').click()
  await page.getByTestId('content-row').filter({ hasText: '2025' }).getByRole('link').click()

  await expect(page.getByTestId('content-title')).toHaveText('2025')
  // Frontmatter is collapsed by default
  await expect(page.locator('#frontmatter-fields')).toBeHidden()
  await expect(page.getByTestId('save')).toBeDisabled()

  await page.getByTestId('frontmatter-toggle').click()
  const tags = page.getByTestId('fm-row-tags').getByRole('textbox', { name: 'Value' })
  await tags.fill('Life')
  await tags.press('Enter')

  // Upload an image through the editor's image block
  await page.locator('.milkdown .ProseMirror').click()
  await page.keyboard.press('ControlOrMeta+End')
  // Top bar groups: bold/italic/strike/code, lists ×3, link/image/table, … → image is item 8
  await page.locator('.milkdown-top-bar .top-bar-item').nth(8).click()
  const fileInput = page.locator('.milkdown input[type=file]').first()
  await fileInput.setInputFiles({ name: 'Beach Day.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) })
  await expect(page.locator('.milkdown img[src*="beach-day.png"]')).toHaveCount(1, { timeout: 10_000 })

  await page.getByTestId('save').click()
  await commitWith(page, 'Update 2025 with a photo')
  await expect(page.getByText('Changes pushed', { exact: true })).toBeVisible()

  const last = (await commits(page)).at(-1)!
  expect(last.message).toBe('Update 2025 with a photo')
  expect(last.changes.map(c => c.path).sort()).toEqual(['content/2025/beach-day.png', 'content/2025/index.md'])

  const file = await (await page.request.get('/api/__fake/file?repo=zuramai/til&path=content/2025/index.md')).json()
  expect(file.content).toMatch(/tags:\n\s+- Journal\n\s+- Life/)
  expect(file.content).toContain('](./beach-day.png)')
  expect(file.content).not.toContain('![1.00]')
})

test('delete content', async ({ page }) => {
  await login(page)
  await page.getByTestId('project-til').getByRole('link').click()
  const row = page.getByTestId('content-row').filter({ hasText: '3m-dalam-debat' })
  await row.hover()
  await row.getByTestId('delete-content').click()
  await commitWith(page, 'Remove 3m post')

  await expect(page.getByText('Deleted and pushed', { exact: true })).toBeVisible()
  await expect(page.getByTestId('content-row').filter({ hasText: '3m-dalam-debat' })).toHaveCount(0)
  expect((await commits(page)).at(-1)).toMatchObject({ message: 'Remove 3m post', changes: [{ path: 'content/3m-dalam-debat/index.md', deleted: true }] })
})

test('remove a project after confirming', async ({ page }) => {
  await login(page)
  await page.getByTestId('project-gallery').getByRole('link').click()
  await page.getByTestId('remove-project').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('are not touched')
  await dialog.getByTestId('confirm').click()

  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByTestId('project-gallery')).toHaveCount(0)
  await expect(page.getByTestId('project-til')).toBeVisible()
})
