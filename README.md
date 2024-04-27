# Jetstream

<img src="./jetstream-logo-white-plate.png" />

**A better way to work on Salesforce**

The Jetstream platform makes managing your Salesforce instances a breeze. Use Jetstream to work with your data and metadata to get your work done faster.

Learn more by [reading the docs](https://docs.getjetstream.app/).

**JETSTREAM IS SOURCE-AVAILABLE AND FREE TO USE. IF YOUR COMPANY IS GETTING VALUE, CONSIDER SPONSORING THE PROJECT ❤️**

Jetstream wouldn't be possible without your contributions.

[![](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86)](https://github.com/sponsors/jetstreamapp)

There are multiple ways to use Jetstream.

1. Use the hosted version at https://getjetstream.app
2. Run locally
   1. Using nodejs
      1. Building yourself (recommended if you want to contribute to the Jetstream codebase)
   2. Using Docker
3. Want to self-host behind your company firewall? Reach out to the team for assistance.

# Overview of the codebase structure

This project was generated using [Nx](https://nx.dev) - This repository is considered a mono-repo and has multiple applications

```
├── app (This is used in the generation of the desktop application)
├── apps (Application)
│   ├── api (BACKEND NODE SERVER)
│   ├── cron-tasks
│   ├── docs (DOCS WEBSITE)
│   ├── download-zip-sw
│   ├── jetstream (FRONTEND REACT APPLICATION)
│   ├── jetstream-e2e
│   ├── jetstream-worker
│   ├── landing (LANDING PAGE WEBSITE)
│   ├── maizzle (EMAIL TEMPLATE GENERATION)
│   └── ui-e2e
├── custom-typings
├── dist (FOLDER CREATED ONCE APPLICATION IS BUILT)
├── libs (CORE LIBRARIES SHARED ACROSS ALL APPLICATIONS)
│   ├── api-config
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

**IF YOU HAVE ANY ISSUES WITH THE STEPS BELOW, PLEASE FILE A TICKET.**

**Pre-req**

1. Make sure you have node 20 installed.
2. If you are using docker, make sure you have Docker installed.
3. If you want to run the dev server, make sure you have yarn version 1 installed.

📓 You can choose to skip authentication locally by setting the environment variable `EXAMPLE_USER_OVERRIDE=true`. This is set to true by default in the `.env.example` file.
🌟 To use this, don't click the login button, but instead just go to `http://localhost:3333/app` or `http://localhost:4200/app` (if running the react development server) directly.

### Using Docker

If you have docker and just want to run the application locally, using docker is the easiest option.

Build the docker image (this takes a while the first time).

```shell
docker build -t jetstream-app .
```

Use docker compose to create a dockerized postgres database and run the app.

```shell
docker compose up
```

- Jetstream will be running at `http://localhost:3333`
- Postgres will be running on port `5555` if you wanted to connect to it locally.
- When you click "Login", you should immediately be logged in without having to sign in.
  - You can set `EXAMPLE_USER_OVERRIDE` if you want to disable this behavior
- If assets on the page don't load, do a hard refresh (hold cmd or shift and press refresh)
  - This might happen if you have re-built the image and the browser has cached the page with now missing resources.

### Running without Docker

Use this option if you want to contribute to the codebase.

Jetstream relies on a Postgres database, so you either need to [run Postgresql locally](https://www.postgresql.org/download/) or use a managed provider such as one from the list below. Optionally you can run jetstream in a Docker container which includes Postgresql.

- [Render](https://render.com/) (Jetstream is hosted here)
- [elephantsql](https://www.elephantsql.com/plans.html)
- [AWS](https://aws.amazon.com/rds/postgresql/)
- [Azure](https://azure.microsoft.com/en-us/services/postgresql/)
- [GCP](https://cloud.google.com/sql/docs/postgres)

You can use the example Salesforce OAuth2 client secret or client id, but you are welcome to create you own connected app in any Salesforce org of your choice.

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

### Building

⭐ If you want to contribute to Jetstream, this is the best option.

##### Configure environment

- [Install postgres](https://www.postgresql.org/download/)
  - ensure this is running with a database called `postgres` and a user named `postgres` on default port 5432
    - If your database is cloud hosted or named something different, then you can adjust the environment variable in `.env` after you initialize your application and this file is created.
- [Install node 16+](https://nodejs.org/en/download/)
  - Version 18 is preferred, but 16 will work.
- [Install Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable)
- Install dependencies
  - Run `yarn` to install all dependencies
- Initialize `.env` file
  - `yarn init:project` (or manually copy `.env.example` to `.env`)
  - If you need to adjust your postges connection, you can do so now.
- **Running in production mode**
  - Build application
    - `yarn build` (this may take some time - if the build is cached in the cloud, this may run quickly)
  - Start Jetstream
    - `yarn db:migrate` to initialize database
    - `yarn db:seed` to insert required records for the application
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
      - This runs on `http://localhost:3333` - most endpoints are prefixed at the `/api` path
    - terminal 2: `yarn start` to start api server
      - This runs on `http://localhost:4200` and you will need to access the application here `http://localhost:4200/app`
  - Optional
    - `yarn start:ui:storybook` to start the storybook server
      - This runs on `http://localhost:4400`
      - You can check out the public version of this at https://storybook.getjetstream.app

### Start Jetstream (with docker)

⚠️ Docker requires a computer with substantial resources.

1. Make sure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
2. Run `docker compose up` in your terminal
   1. This may take a while the very first time
   2. If you make any changes, you need to re-build the application using `docker compose build`
