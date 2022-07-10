# Jetstream

Jetstream is a tool for Salesforce administrators.

Learn more by [reading the docs](https://docs.getjetstream.app/).

There are multiple ways to use Jetstream.

1. Use the hosted version at https://getjetstream.app
2. Use the desktop version, download here **TODO:**
3. Run locally
   1. Using nodejs
      1. Building yourself (recommended if you want to contribute to the Jetstream codebase)
      2. Using the pre-built version, downloaded here **TODO:**
   2. Using Docker

# Overview of the codebase structure

This project was generated using [Nx](https://nx.dev) - This repository is considered a mono-repo and has multiple applications

```
├── app (This is used in the generation of the desktop application)
├── apps (Application)
│   ├── api (BACKEND NODE SERVER)
│   ├── cron-tasks
│   ├── docs (DOCS WEBSITE)
│   ├── download-zip-sw
│   ├── electron (DESKTOP APPLICATIONS)
│   │   ├── jetstream (DESKTOP BACKEND)
│   │   ├── preferences (DESKTOP PREFERENCES)
│   │   └── worker (DESKTOP WORKER - REPLACES API BACKEND NODE SERVER)
│   ├── jetstream (FRONTEND REACT APPLICATION)
│   ├── jetstream-e2e
│   ├── jetstream-worker
│   ├── landing (LANDING PAGE WEBSITE)
│   ├── landing-e2e
│   ├── maizzle (EMAIL TEMPLATE GENERATION)
│   └── ui-e2e
├── build (DESKTOP BUILD)
├── custom-typings
├── dist (FOLDER CREATED ONCE APPLICATION IS BUILT)
├── electron-scripts
├── libs (CORE LIBRARIES SHARED ACROSS ALL APPLICATIONS)
│   ├── api-config
│   ├── api-interfaces
│   ├── connected (FRONTEND DATA LIBRARY)
│   ├── icon-factory (SFDC ICONS)
│   ├── monaco-configuration
│   ├── shared (SHARED UTILS ETC..)
│   ├── splitjs
│   ├── types (TYPESCRIPT TYPES)
│   └── ui (ANYTHING UI RELATED)
├── prisma (DB MIGRATIONS)
│   └── migrations
├── scripts
└── tools
    └── generators
```

# Getting Started

## Running Locally

The easiest way to run Jetstream is to download the pre-built and transpiled javascript files and run them using NodeJs.

Jetstream relies on a Postgres database, so you either need to [run Postgresql locally](https://www.postgresql.org/download/) or use a managed provider such as one from the list below. Optionally you can run jetstream in a Docker container which includes Postgresql.

- [Render](https://render.com/) (Jetstream is hosted here)
- [elephantsql](https://www.elephantsql.com/plans.html)
- [AWS](https://aws.amazon.com/rds/postgresql/)
- [Azure](https://azure.microsoft.com/en-us/services/postgresql/)
- [GCP](https://cloud.google.com/sql/docs/postgres)

You can use the example OAuth2 client secret or client id, but you are welcome to create you own connected app in any Salesforce org of your choice.

If you want to create your own:

1. Login to any org where you are an admin, usually a developer org or production org is best
2. Setup > App Manager > New Connected App
   1. name it whatever you want
   2. Click "Enable OAuth Settings"
      1. Callback URL: `http://localhost:3333/oauth/sfdc/callback`
      2. Scopes:
         1. Access the identity URL service `id, profile, email, address, phone`
         2. Access unique user identifiers `openid`
         3. Manage user data via APIs `api`
         4. Perform requests at any time `refresh_token, offline_access`
      3. All other defaults are fine
3. Update the file named `.env` and replace `SFDC_CONSUMER_KEY` and `SFDC_CONSUMER_SECRET` with the values from your connected app.

### Download pre-built application

This is the fastest 🏃 way to run Jetstream locally.

TODO: instructions to download and instructions to run
TODO: include instructions on how to have a local user

### Building

⭐ If you want to contribute to Jetstream, this is the best option.

##### Configure environment

- [Install postgres](https://www.postgresql.org/download/)
  - ensure this is running with a database called `postgres` and a user named `postgres` on default port 5432
    - If your database is cloud hosted or named something different, then you can adjust the environment variable in `.env` after you initialize your application and this file is created.
- [Install node 16+](https://nodejs.org/en/download/)
  - Other versions of node should work, but are untested
- [Install Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable)
- Install dependencies
  - Run `yarn` to install all dependencies
- Initialize `.env` file
  - `yarn init:project` (or manually copy `.env.example` to `.env`)
  - If you need to adjust your postges connection, you can do so now.
- **Running in production mode**
  - Build application
    - `yarn build` (this may take 5 - 10 minutes)
  - Start Jetstream
    - `yarn db:migrate` to initialize database
    - `node dist/apps/api/main.js`
    - Visit in a web browser - TODO: **allow skipping auth**
      - `http://localhost:3333/app`
- **Running in development mode - use this option if you want to work with the codebase**
  - Build required applications
    - `yarn build:landing`
    - `yarn build:sw`
    - `yarn db:generate`
  - Start Jetstream
    - terminal 1: `yarn start:api` to start api server
      - This runs on `http://localhost:3333`
    - terminal 2: `yarn start` to start api server
      - This runs on `http://localhost:4200`
  - Optional
    - `yarn start:ui:storybook` to start the storybook server
      - This runs on `http://localhost:4400`
      - You can check out the public version of this at https://jestream-storybook.onrender.com

### Start Jetstream (with docker)

⚠️ Docker requires a computer with substantial resources.

1. Make sure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
2. Download the pre-built version of the application here **TODO:**
   1. Optionally you can build from sources, following the steps above 👆
3. Run `docker compose up` in your terminal
   1. This may take a while the very first time

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
