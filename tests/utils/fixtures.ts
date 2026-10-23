import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RepoSnapshot } from '../../server/utils/ssg/types'

export const FIXTURES_DIR = fileURLToPath(new URL('../fixtures/repos', import.meta.url))

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

/** Loads a fixture repository into memory as `{ path: Buffer }`. */
export function loadFixtureFiles(name: string): Record<string, Buffer> {
  const root = join(FIXTURES_DIR, name)
  return Object.fromEntries(walk(root).map(file => [relative(root, file).split('\\').join('/'), readFileSync(file)]))
}

export function fixtureSnapshot(name: string): RepoSnapshot {
  const files = loadFixtureFiles(name)
  return {
    paths: Object.keys(files).sort(),
    read: async path => files[path]?.toString('utf8') ?? null,
  }
}
