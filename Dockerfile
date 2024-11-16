# syntax = docker/dockerfile:1

ARG NODE_VERSION=20.10.0
ARG ENVIRONMENT=production

FROM node:${NODE_VERSION}-slim AS base

# App lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ARG YARN_VERSION=1.22.21
RUN npm install -g yarn@$YARN_VERSION --force

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp openssl pkg-config python-is-python3

# Install node modules
COPY --link package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

# Generate Prisma Client
COPY --link prisma .
RUN yarn run db:generate

# Copy application code
COPY --link . .

# Build application
RUN yarn build:core && \
    yarn build:landing && \
    # Replace dependencies with only the ones required by API
    yarn scripts:replace-deps && \
    rm -rf .nx

# Remove development dependencies and unused prod dependecies
RUN yarn install --production=true && \
    yarn add cross-env npm-run-all --save-dev

# FIXME: figure out why this is not included
# Add missing dependencies
RUN yarn add @react-email/components

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
CMD [ "yarn", "run", "start:prod" ]
