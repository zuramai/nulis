// Boots MongoDB (in memory) and the built Nuxt server in fake-git mode for Playwright.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { MongoMemoryServer } from 'mongodb-memory-server'

const port = process.env.PORT ?? '3100'

if (process.env.E2E_SKIP_BUILD !== 'true') {
  const build = spawnSync('npx', ['nuxt', 'build'], { stdio: 'inherit' })
  if (build.status !== 0)
    process.exit(build.status ?? 1)
}

const systemBinary = process.env.MONGOMS_SYSTEM_BINARY
  ?? ['/opt/homebrew/bin/mongod', '/usr/local/bin/mongod', '/usr/bin/mongod'].find(p => existsSync(p))
const mongo = await MongoMemoryServer.create(systemBinary ? { binary: { systemBinary } } : {})

const server = spawn('node', ['.output/server/index.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: port,
    NUXT_MONGODB_URI: mongo.getUri('nulis_e2e'),
    NUXT_FAKE_GIT: 'true',
    NUXT_SESSION_PASSWORD: 'e2e-session-password-0123456789-abcdef',
    NUXT_ENCRYPTION_KEY: 'e2e-encryption-key-0123456789-abcdefgh',
  },
})

async function shutdown() {
  server.kill()
  await mongo.stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
server.on('exit', async (code) => {
  await mongo.stop()
  process.exit(code ?? 0)
})
