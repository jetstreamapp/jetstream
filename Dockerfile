# syntax = docker/dockerfile:1

ARG NODE_VERSION=22
ARG ENVIRONMENT=production

FROM node:${NODE_VERSION}-slim AS base

# App lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ARG PNPM_VERSION=11.1.2
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp openssl pkg-config python-is-python3

# Install node modules
COPY --link package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Generate Prisma Client
COPY --link prisma .
RUN pnpm db:generate

# Copy application code
COPY --link . .

# Build application
RUN pnpm build:core && \
    pnpm build:landing && \
    # Replace dependencies with only the ones required by API
    pnpm scripts:replace-deps && \
    rm -rf .nx

# Remove development dependencies and unused prod dependecies
RUN pnpm install --prod --no-frozen-lockfile && \
    pnpm add -D cross-env npm-run-all

# FIXME: figure out why this is not included
# Add missing dependencies
RUN pnpm add @react-email/components

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
