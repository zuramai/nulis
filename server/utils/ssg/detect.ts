import type { DetectionResult, Detector, RepoSnapshot } from './types'
import { astro } from './detectors/astro'
import { eleventy } from './detectors/eleventy'
import { generic } from './detectors/generic'
import { hugo } from './detectors/hugo'
import { jekyll } from './detectors/jekyll'

// Order matters: specific configs first, the generic fallback last.
const DETECTORS: Detector[] = [astro, hugo, jekyll, eleventy, generic]

/** Files whose change should trigger re-detection during a sync. */
export const DETECTION_INPUTS = /^(astro\.config\.|src\/content\.config\.|src\/content\/config\.|hugo\.|config\.|config\/_default\/|_config\.ya?ml|\.?eleventy|archetypes\/|scaffolds\/|\.nulis\/)/

export async function detectSsg(repo: RepoSnapshot): Promise<DetectionResult> {
  for (const detector of DETECTORS) {
    const result = await detector.detect(repo)
    if (result && result.collections.length)
      return { ssg: detector.kind, ...result }
  }
  return { ssg: 'generic', collections: [], templates: [] }
}
