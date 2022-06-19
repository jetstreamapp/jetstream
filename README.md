# Jetstream

This project was generated using [Nx](https://nx.dev)

# Getting Started

Before working, install dependencies using `yarn install`.

## Running Locally

Open up multiple terminal windows and run the following commands in individual terminals:

1. `yarn start` to start the development server
   1. This runs on `http://localhost:4200`
2. `yarn start:api` to start the api server
   1. This runs on `http://localhost:3333`
3. `yarn start:ui:storybook` to start the storybook server (this is optional)
   1. This runs on `http://localhost:4400`

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
