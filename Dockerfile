# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.10.0
ARG ENVIRONMENT=production
ARG CONTENTFUL_SPACE=wuv9tl5d77ll
ARG CONTENTFUL_TOKEN=0HoGc9QPgrk3kXSIO6YvAZ0JMcD8CkGKLQF9-su9-tg
ARG CONTENTFUL_HOST=https://api.contentful.com

FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

# Node/Prisma app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ARG YARN_VERSION=1.22.19
RUN npm install -g yarn@$YARN_VERSION --force


# Throw-away build stage to reduce size of final image
FROM base as build

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
RUN --mount=type=secret,id=CONTENTFUL_TOKEN \
    --mount=type=secret,id=NX_AMPLITUDE_KEY \
    --mount=type=secret,id=NX_ROLLBAR_KEY \
    CONTENTFUL_TOKEN="$(cat /run/secrets/CONTENTFUL_TOKEN)" \
    NX_AMPLITUDE_KEY="$(cat /run/secrets/NX_AMPLITUDE_KEY)" \
    NX_ROLLBAR_KEY="$(cat /run/secrets/NX_ROLLBAR_KEY)" \
    yarn run build:core:new

RUN --mount=type=secret,id=CONTENTFUL_TOKEN \
    --mount=type=secret,id=NX_AMPLITUDE_KEY \
    --mount=type=secret,id=NX_ROLLBAR_KEY \
    CONTENTFUL_TOKEN="$(cat /run/secrets/CONTENTFUL_TOKEN)" \
    NX_AMPLITUDE_KEY="$(cat /run/secrets/NX_AMPLITUDE_KEY)" \
    NX_ROLLBAR_KEY="$(cat /run/secrets/NX_ROLLBAR_KEY)" \
    yarn run build:landing

# Remove development dependencies
RUN yarn install --production=true


# Final stage for app image
FROM base

# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3333
CMD [ "yarn", "run", "start:prod" ]
