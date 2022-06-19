# BUILDER
FROM node:16 AS builder

WORKDIR /usr/src/app

COPY . .

RUN yarn install

ENV NEXT_TELEMETRY_DISABLED 1

# RUN npx prisma migrate deploy

RUN yarn build:docker

# RUNNER
FROM node:16 as runner

# Create app directory
WORKDIR /usr/src/app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# # RUN yarn install
# # If you are building your code for production
# RUN yarn install --frozen-lockfile --only=production

# RUN yarn install pm2

# # Copy all files to docker container
# COPY . .

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 jetstream

COPY --chown=jetstream:nodejs --from=builder /usr/src/app/ ./

USER jetstream

ENV ENVIRONMENT production


EXPOSE 3333

CMD [ "pm2-runtime", "start", "ecosystem.config.js", "--env", "production" ]
