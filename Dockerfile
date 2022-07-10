# docker build -f Dockerfile . -t jetstream
# docker-compose up

# Login and run DB migrations (TODO: figure out how to automate this)
# https://medium.com/@sumankpaul/run-db-migration-script-in-docker-compose-ce8e447a77ba
# docker ps
# docker exec -it 791 bash
# npx prisma migrate deploy

# TODO: auth redirect flow is broken, need to fix it

FROM node:16

WORKDIR /usr/src/app

# Copy application
COPY ./dist/apps/api ./dist/apps/api/
COPY ./dist/apps/jetstream ./dist/apps/jetstream/
COPY ./dist/apps/download-zip-sw ./dist/apps/download-zip-sw/
COPY ./dist/apps/landing ./dist/apps/landing/

# Copy supporting files
COPY ./dist/apps/api/package.json .
COPY ./yarn.lock .
COPY ./.env .
COPY ./ecosystem.config.js .
COPY ./prisma ./prisma/

# Install core dependencies
RUN yarn

# Install other dependencies that were not calculated by nx, but are required
RUN yarn add dotenv prisma@^3.13.0

# Generate prisma client - ensure that there are no OS differences
RUN npx prisma generate

EXPOSE 3333
EXPOSE 9229

CMD [ "node", "--inspect", "dist/apps/api/main.js" ]
