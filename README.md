# Nulis

<img width="2178" height="1216" alt="image" src="https://github.com/user-attachments/assets/d5b6c546-52cb-4693-9c24-debfcb3d71c5" />

A content editor for static site generator repositories on GitHub. Connect your repositories and Nulis
detects the generator, finds where the content lives, and lets you write in a WYSIWYG markdown editor.
Every save is a commit pushed to the repository.

- **Detects the SSG and its content layout.** Supports Hugo (page bundles or flat files, archetypes as
  templates), Astro (content collections read from `src/content.config.ts`), Jekyll and Eleventy, with a
  generic fallback for any repo of markdown files.
- **Finds where images go.** Hugo bundles keep images beside `index.md`. Flat collections use the folder
  their existing images live in (e.g. `src/photos/images`).
- **Content table** with search, sorting and configurable columns for any frontmatter key, including
  nested keys like `camera_settings.iso`.
- **Editor**:
  - A frontmatter panel, collapsed by default.
  - A Milkdown WYSIWYG editor.
  - Image upload: images are inserted as `![caption](url)` and committed together with the post.
- **New content from templates.** Uses Hugo archetypes, `.nulis/templates/*.md`, or a template inferred
  from existing content.
- **Sync** picks up changes pushed outside Nulis. Saves are refused if the file changed upstream.

Single-owner: the first visitor creates the account, then registration closes.

## Stack

- **App:** Nuxt 4, Nuxt UI, Milkdown Crepe, `nuxt-auth-utils`.
- **Data:** MongoDB (Mongoose).
- **GitHub:** Octokit.
- **Tests:** Vitest and Playwright.

## Running with Docker

1. Create a GitHub OAuth App at <https://github.com/settings/developers>, with the authorization callback
   URL `http://localhost:3000/auth/github` (or your domain).
2. Create `.env`:

   ```sh
   NUXT_SESSION_PASSWORD=<random 32+ chars>   # openssl rand -hex 24
   NUXT_ENCRYPTION_KEY=<random 32+ chars>     # encrypts GitHub tokens at rest
   NUXT_OAUTH_GITHUB_CLIENT_ID=...
   NUXT_OAUTH_GITHUB_CLIENT_SECRET=...
   ```

3. Start it:

   ```sh
   docker compose up -d --build
   ```

4. Open <http://localhost:3000>.

**Behind a reverse proxy:** set `NUXT_OAUTH_GITHUB_REDIRECT_URL=https://your.domain/auth/github` if the
callback URL is detected wrongly.

**MongoDB version:** compose uses `mongo:7.0` by default. MongoDB 8 currently refuses to start on Linux
kernels ≥ 6.19 ([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)). Set `MONGO_VERSION=8` if
your host kernel is older.

**Demo mode:** set `NUXT_FAKE_GIT=true` to skip GitHub entirely. Nulis then uses an in-memory git host
seeded with sample Hugo, Astro and Jekyll repositories. Changes are lost on restart.

## Development

You need Node 22+ and pnpm. The test suites need a local `mongod`, or let `mongodb-memory-server`
download one.

```sh
pnpm install
cp .env.example .env    # fill in the secrets; NUXT_FAKE_GIT=true works without GitHub
pnpm dev
```

| Command | What it does |
| --- | --- |
| `pnpm test` | Unit tests (detectors, frontmatter round-trips, templates, paths) and API tests (a built server against an in-memory MongoDB and fake GitHub) |
| `pnpm test:e2e` | Playwright end-to-end tests for the full flow, in fake-GitHub mode. Run `npx playwright install chromium` once first. |
| `pnpm typecheck` | Type checking |

## How content is detected

| SSG | Detected by | Content | Images |
| --- | --- | --- | --- |
| Hugo | `hugo.*`, or `config.*` alongside `archetypes/`, `layouts/` or `themes/` | `contentDir` (default `content/`); `*/index.md` bundles or flat files per section | Bundle directory, or the folder existing images use |
| Astro | `astro.config.*` | `glob({ base, pattern })` loaders in `src/content.config.ts`, else `src/content/*` | Inferred from existing references, e.g. `src/photos/images` |
| Jekyll | `_config.yml` with `_posts/` or `_layouts/` | `_posts`, `_drafts`, custom `_collections` | Inferred, else `assets/images` |
| Eleventy | `eleventy.config.*` or `.eleventy.js` | Markdown under the configured `input` directory | Inferred |
| Other | — | Folders with the most markdown | Inferred |

Detection re-runs on sync whenever a config file changes.

**Templates** are read from:
- Hugo `archetypes/`. The common Go template helpers work: `.Name`, `.Date`, `replace`, `title`, and
  pipes.
- `.nulis/templates/*.md`.

If neither exists, Nulis builds a template from the frontmatter keys of your existing content.
