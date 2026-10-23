import { existsSync } from 'node:fs'
import { MongoMemoryServer } from 'mongodb-memory-server'

/** Starts a throwaway MongoDB, reusing a locally installed `mongod` when there is one. */
export async function startMongo() {
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY
    ?? ['/opt/homebrew/bin/mongod', '/usr/local/bin/mongod', '/usr/bin/mongod'].find(p => existsSync(p))
  return MongoMemoryServer.create(systemBinary ? { binary: { systemBinary } } : {})
}
