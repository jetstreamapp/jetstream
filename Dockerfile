# syntax = docker/dockerfile:1

ARG NODE_VERSION=20.10.0
ARG ENVIRONMENT=production

FROM node:${NODE_VERSION}-slim as base

# App lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ARG YARN_VERSION=1.22.21
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
RUN yarn build:core
RUN yarn build:landing

# Remove development dependencies
RUN yarn install --production=true


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
