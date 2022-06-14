# Jetstream

This project was generated using [Nx](https://nx.dev)

# Getting Started

Before working, install dependencies using `npm install`.

## Running Locally

Open up multiple terminal windows and run the following commands in individual terminals:

1. `npm start` to start the development server
   1. This runs on `http://localhost:4200`
2. `npm run start:api` to start the api server
   1. This runs on `http://localhost:3333`
3. `npm run start:ui:storybook` to start the storybook server (this is optional)
   1. This runs on `http://localhost:4400`

## Electron

### Local development

- Start jetstream local server
  - `npm run start`
- Start electron-worker in watch mode (background renderer - rebuild on changes)
  - `npm run start:start:electron-worker`
- Start electron app
  - `npm run start:electron`

## Packaging

TODO:
