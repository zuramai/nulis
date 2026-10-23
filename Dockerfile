# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile

COPY . .
RUN pnpm install --offline --frozen-lockfile && pnpm build

# ---- runtime --------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# The Nitro output is self-contained; no node_modules needed
COPY --from=build --chown=node:node /app/.output ./.output
# Sample repositories for the optional demo mode (NUXT_FAKE_GIT=true)
COPY --from=build --chown=node:node /app/tests/fixtures/repos ./tests/fixtures/repos

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/auth/status" > /dev/null || exit 1

CMD ["node", ".output/server/index.mjs"]
