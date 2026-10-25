# Colyseus game server (app/server) for Render.
#
# Build context is the repository ROOT: this is an npm-workspaces monorepo and
# the server imports `@root/shared` from its workspace `dist/`, so the whole
# tree must be present at build time. See https://docs.colyseus.io/deployment.
FROM node:22-slim

WORKDIR /app

# Copy workspace manifests first so `npm ci` is cached until a lockfile changes.
# Every workspace's package.json is required for npm to resolve the lockfile.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY app/server/package.json app/server/
COPY app/client/package.json app/client/

RUN npm ci

COPY . .

# `@root/shared` must be compiled before the server (it imports from dist/),
# then compile the server. Production runs the compiled JS, never tsx.
RUN npm run build:shared \
    && npm run build --workspace=app/server

ENV NODE_ENV=production
# Render injects its own PORT; this is only a local/fallback default.
ENV PORT=2567
EXPOSE 2567

CMD ["node", "app/server/build/index.js"]
