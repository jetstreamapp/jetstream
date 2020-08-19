# Jetstream Authentication

This folder contains the application for the jetstream authentication service.

This is deployed as a docker image to Render with a slightly different process from running the service remotely.

## Upgrading

- Update the version in the dockerfile
  - ⚠️ MAKE SURE TO UPDATE BOTH VERSION REFERENCES ⚠️
  - https://hub.docker.com/r/fusionauth/fusionauth-app/tags
- Download the zip from the same version
  - https://fusionauth.io/direct-download
- In the zip download, run all the migrations required in order, starting from the version one higher than the current version
  - Example:
  - `{psql command from render.com} -f 1.17.3.sql`
  - `{psql command from render.com} -f 1.18.0.sql`
  - `{psql command from render.com} -f 1.18.2.sql`

## Running Locally

https://fusionauth.io/docs/v1/tech/installation-guide/docker

1. Ensure Docker Desktop is installed and running
1. Ensure postgres is installed and running
1. Open a terminal and navigate to this directory
1. Ensure that an `.env` file exists and is configured as shown below
1. Run `docker-compose up`

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_USER=fusionauth
DATABASE_PASSWORD=hkaLBM3RVnyYeYeqE3WI1w2e4Avpy0Wd5O3s3

ES_JAVA_OPTS=-Xms512m -Xmx512m

FUSIONAUTH_MEMORY=512M
```

## Running On Server

These are the steps for configuring a fresh install

https://fusionauth.io/docs/v1/tech/installation-guide/fusionauth-app#advanced-installation

1. navigate to this directory
2. Pre-Configure database
   1. ensure psql is installed using `brew install postgres`
   2. Run database setup script
      1. `PGPASSWORD=dbpassword psql -h postgres.render.com -U dbusername dbname < postgresql.sql`
3.
