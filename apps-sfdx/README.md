# Jetstream for Salesforce

A managed package that embeds [Jetstream](https://getjetstream.app) directly inside Salesforce as a
[canvas app](https://developer.salesforce.com/docs/platform/canvas-developer-guide/overview), giving users a powerful workspace to
query, load, update, and manage their data and metadata without leaving their org.

- **Package name:** `Jetstream for Salesforce`
- **Namespace:** `jetstream`
- **Type:** Managed (2GP)

## What's included

| Component           | API Name                  | Purpose                                                                                    |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| External Client App | `Jetstream_Canvas`        | The canvas app definition, OAuth settings, and policies that embed Jetstream               |
| Custom Application  | `Jetstream`               | Lightning app that hosts the Jetstream tab                                                 |
| Custom Tab          | `JetstreamAppTab`         | Tab that renders the Visualforce wrapper page                                              |
| Visualforce Page    | `JetstreamPage`           | Full-screen wrapper that hosts the canvas iframe                                           |
| Apex Controller     | `JetstreamPageController` | Supplies canvas parameters (e.g. full-screen detection) to the page                        |
| Custom Setting      | `UserPreferences__c`      | Hierarchy custom setting storing per-user preferences (SOQL formatting, record sync, etc.) |
| Permission Set      | `Jetstream`               | Grants access to the app, tab, page, and user-preference fields                            |

## Accessing the app

After the package is installed and the **Jetstream** permission set is assigned (see [Permissions](#permissions)):

- Open the **App Launcher** and search for **Jetstream**, or
- Navigate directly to the Lightning app: `/lightning/app/jetstream__Jetstream`

## Requirements

For local development and packaging you'll need:

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`)
- A Dev Hub org with the `jetstream` namespace linked
- [Node.js](https://nodejs.org) (for the helper scripts)

All commands below are run from the `apps-sfdx/` directory.

## Local development

Spin up a fully configured scratch org (creates the org, deploys source, assigns the `Jetstream` permission set, sets a password, and
opens the org):

```bash
npm run org:scratch:create
```

### Environment variables

The canvas URL in the package points at production (`https://getjetstream.app/canvas/app`). To point a scratch org at a local or
staging Jetstream instance, create a `.env.local` file and the `replacements` block in `sfdx-project.json` will swap the URL on deploy:

```bash
# apps-sfdx/.env.local
SFDX_ENV=DEVELOPMENT
JETSTREAM_CANVAS_BASE_URL=http://localhost:3333
```

The override only applies when `SFDX_ENV=DEVELOPMENT`; production package builds always use the `getjetstream.app` URL.

## Project structure

```
apps-sfdx/
├── canvas-app/
│   ├── jetstream/        # Packaged source (everything that ships in the managed package)
│   │   └── main/default/
│   │       ├── applications/         # Jetstream Lightning app
│   │       ├── classes/              # Apex controller + tests
│   │       ├── contentassets/        # App logo
│   │       ├── externalClientApps/   # Canvas app (ECA) + OAuth/canvas settings & policies
│   │       ├── objects/              # UserPreferences__c custom setting + fields
│   │       ├── pages/                # JetstreamPage Visualforce wrapper
│   │       ├── permissionsets/       # Jetstream permission set
│   │       └── tabs/                 # JetstreamAppTab
│   └── unpackaged/       # Source deployed to dev orgs but NOT included in the package
├── config/               # Scratch org definition files
└── scripts/              # Helper scripts (scratch org creation, etc.)
```

## Permissions

Access to the canvas app is gated by the **Jetstream** permission set. The External Client App's OAuth policy pre-authorizes this
permission set (`AdminApprovedPreAuthorized`), so assigning it both grants UI access and authorizes the OAuth connection:

```bash
sf org assign permset --name Jetstream --target-org <org-alias>
```

Subscribers must assign this permission set to any user who needs the app.
