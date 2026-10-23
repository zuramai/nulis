import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PORT ?? 3100)

export default defineConfig({
  testDir: './tests/e2e',
  // The suite walks through one installation from first run to removal, so it runs in order
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: 'node tests/e2e/server.mjs',
    url: `http://localhost:${port}/api/auth/status`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { PORT: String(port) },
  },
})
