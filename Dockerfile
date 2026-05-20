# syntax = docker/dockerfile:1

ARG NODE_VERSION=24
ARG ENVIRONMENT=production

FROM node:${NODE_VERSION}-slim AS base

# App lives here
WORKDIR /app

# Set production environment.
ENV NODE_ENV=production
ARG PNPM_VERSION=11.1.3
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Throw-away build stage to reduce size of final image
FROM base AS build

# CI=true tells pnpm to skip the interactive confirmation prompt when it needs
# to purge node_modules between installs (otherwise it aborts with
# ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY). Scoped to the build stage so
# the runtime image doesn't inherit CI semantics.
ENV CI=true

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp openssl pkg-config python-is-python3

# Install node modules. Workspace members (apps/docs, apps-sfdx) declared in
# pnpm-workspace.yaml must be present on disk for `--frozen-lockfile` to
# resolve them — otherwise pnpm rejects the install. Their package.json files
# are copied here so the install stage can operate in workspace mode and
# honor the overrides recorded in the lockfile. --ignore-scripts skips the
# root preinstall (package-manager check, irrelevant here since we're
# explicitly pnpm) and postinstall (prisma generate, which is done in its
# own step below after the schema is copied in).
COPY --link package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --link apps/docs/package.json ./apps/docs/
COPY --link apps-sfdx/package.json ./apps-sfdx/
RUN pnpm install --frozen-lockfile --prod=false --ignore-scripts

# Generate Prisma Client. prisma.config.ts requires JETSTREAM_POSTGRES_DBURI
# via prisma's strict `env()` helper, but `prisma generate` doesn't actually
# connect — a dummy placeholder is enough to satisfy the config loader.
COPY --link prisma ./prisma/
COPY --link prisma.config.ts ./
RUN JETSTREAM_POSTGRES_DBURI=postgres://placeholder pnpm db:generate

# Copy application code
COPY --link . .

# Build application
RUN pnpm build:core && \
    pnpm build:landing && \
    # Replace dependencies with only the ones required by API
    pnpm scripts:replace-deps && \
    rm -rf .nx

# Reinstall with only prod deps + add cross-env / npm-run-all (needed at
# runtime by `start:prod`). Done as a single `pnpm add -P` so pnpm doesn't
# emit ERR_PNPM_INCLUDED_DEPS_CONFLICT between a prod-only install and a
# follow-up add. `--ignore-scripts` skips the root postinstall (`prisma
# generate`), which would fail because prisma is a devDep that isn't being
# installed; the client was already generated above.
RUN pnpm add -w -P cross-env npm-run-all --no-frozen-lockfile --ignore-scripts

# Final stage for app image
FROM base

# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

RUN npm install -g ts-node@10.9.1

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3333
CMD [ "pnpm", "start:prod" ]
