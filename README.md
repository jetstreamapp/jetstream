# Jetstream

This project was generated using [Nx](https://nx.dev)

# Getting Started

Before working, install dependencies using `yarn install`.

## Running Locally

**NOTE: The following steps have only been tested on MacOS and may not work on Windows.**

### Configure environment

- [Install postgres](https://www.postgresql.org/download/)
  - ensure this is running with a database called `postgres` and a user named `postgres` on default port 5432
  - Alternatively you can adjust the `.env.example` based on any differences
- [Install node 16+](https://nodejs.org/en/download/)
- [Install Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable)
- Install dependencies
  - Run `yarn` in this directory
- Initialize `.env` file
  - `yarn init:project` (or manually copy `.env.example` to `.env`)
- **Running in production mode**
  - Build application
    - `yarn build` (this may take 5 - 10 minutes)
  - Start Jetstream
    - `yarn db:migrate` to initialize database
    - `node dist/apps/api/main.js`
    - Visit in a web browser - TODO: **allow skipping auth**
      - `http://localhost:3333/app`
- **Running in development mode**
  - Build landing page
    - `yarn build:landing`
    - `yarn build:sw`
    - `yarn db:generate`
  - Start Jetstream
    - terminal 1: `yarn start:api` to start api server
    - terminal 2: `yarn start` to start api server

### Start Jetstream (without docker)

Open up multiple terminal windows and run the following commands in individual terminals:

1. `yarn start` to start the development server
   1. This runs on `http://localhost:4200`
2. `yarn start:api` to start the api server
   1. This runs on `http://localhost:3333`
3. `yarn start:ui:storybook` to start the storybook server (this is optional)
   1. This runs on `http://localhost:4400`

### Start Jetstream (with docker)

## Electron

### Local development

- Start jetstream local server
  - `yarn start`
- Start electron-worker in watch mode (background renderer - rebuild on changes)
  - `yarn start:electron-worker`
- Start electron app
  - `yarn start:electron`

## Packaging

TODO:
