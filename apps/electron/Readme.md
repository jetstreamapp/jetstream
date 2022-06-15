# Electron

## Development

- Start jetstream app
  - `npm run start`
- Watch all files that might change
  - `npm run start:watch:electron`
- Start electron in watch mode
  - `npm run start:electron`
- If you modified the login/splash page styles, rebuild tailwind CSS file
  - `npm run build:electron:css`

## Quirks

- When the application restarts, if there are multiple application instances open (sometimes they don't quit) all protocol links will go to the older windows, not the new ones 😨.

## App structure

- Splash screen is shown - the first window to load will close it
- Worker renderer is started up (visible in dev mode)
- One of the following loads first, in order, then when closed continues to the next item
  - Auth page **if not logged in**
  - Preferences page **if preferences not set**
  - Application

### Communication

Most applications, except the worker renderer, have context isolation enabled and communicate through a pre-loader loader which exposes some methods to the main window object.

#### API requests

- The main application starts and sends an event to the main process asking for message channels
- The main app generates some message channel ports and transfers them to the worker and the application
  - each application web-worker needs its own message channel to communicate to the worker renderer
- The application/web-worker has a custom axios adapter that instead routes messages to the render window
- The render window routes the request to the proper handler (if one exists) and calls out directly to Salesforce as required

#### Orgs

When a user requests to add an org, the main process intercepts this and opens a native browser.
The user is redirected to Jetstream via a `jetstream://` protocol link to save the org.

The orgs are encrypted and saved to disk (see storage) and sent to the background worker to persist in memory along with all the application windows that exist

#### Storage

The application stores some files in the application data directory:

- orgs (encrypted)
  - array of orgs with access/refresh tokens
- auth (encrypted)
  - access/refresh token + user profile
- preferences.json (plain json)
  - global user preferences

**To test out states or to troubleshoot, you can delete these files to start fresh**

## Application Updates

TODO: need to create update server

## Packaging

### Signing / Notorization

- Mac
  - Ensure the computer is signed in to the developer account
  - install the signing keys into the keychain (on google drive)
  - set the APPLE_ID and APPLE_ID_PASSWORD env variables
    - use an app password, not the real password, for this
  - That should be it!
- Windows$$
  - TODO:

Run various make commands

- `electron:dist:macos`
- `electron:dist:macos:arm64`
- TODO: windows

To troubleshoot, the app can be extracted and viewed

- `electron:extract:asar-x86`
- `electron:extract:asar-arm`

### Building / Publishing / Releasing

Published to public repository

- https://github.com/jetstreamapp/jetstream

- Ensure that `GH_TOKEN` environment variable is set
- run build command
  - `electron:dist:macos`
