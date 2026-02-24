# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jetstream is a comprehensive Salesforce management platform that helps users work with Salesforce data and metadata more efficiently. It consists of:

- Web application (React + Vite)
- Backend API (Node.js + Express)
- Desktop application (Electron)
- Browser extension (Chrome/Firefox)
- Landing page (next JS) and documentation (Docusaurus) sites

## Key Technologies

**Frontend**: React 18, TypeScript, Vite, jotai (state), Emotion (styling), Monaco Editor, Salesforce Lightning Design System (SLDS)
**Backend**: Node.js 22+, Express, Prisma ORM, PostgreSQL, Socket.io, JWT auth
**Build**: Nx monorepo, Vitest (testing), Playwright (E2E), ESLint, Prettier

## Repository Structure

```
apps/
├── api/                      # Express backend (port 3333)
├── jetstream/                # Main React app (port 4200 in dev)
├── jetstream-desktop/        # Electron main process
├── jetstream-desktop-client/ # Electron renderer
├── jetstream-web-extension/  # Browser extension
├── landing/                  # Next.js landing page
├── docs/                     # Docusaurus documentation
└── cron-tasks/               # Scheduled jobs

libs/
├── features/              # Feature modules (query, deploy, load-records, etc.)
├── ui/                    # Shared UI components (@jetstream/ui)
├── shared/                # Shared utilities
├── salesforce-api/        # Salesforce API integration
└── types/                 # TypeScript type definitions

prisma/                    # Database schema and migrations
```

## Commands

There are a number of commands in our package.json that you can use.

You can also use standard `nx` commands as well depending on the task.

```bash
yarn build:core               # Build all core apps
yarn build:client             # Build frontend only
yarn build:api                # Build backend only
yarn build:desktop            # Build desktop app
yarn build:web-extension      # Build browser extension
yarn nx run {project}:build   # Build a specific application (libraries are NOT buildable)

# Testing
yarn test:all                  # Test all projects
yarn test:affected             # Test affected by changes
yarn nx run {project}:test     # Test a specific application or library

# Linting
yarn lint:all                  # Lint all projects
yarn lint:affected             # Lint affected projects
yarn nx run {project}:list     # Test a specific application or library

yarn nx show projects      # Show a list of all projects
yarn nx dep-graph --print  # View dependency graph
yarn nx affected:build     # Build affected projects
yarn nx affected:test      # Test affected projects
```

## Important Project Build Notes

NONE of the libraries are buildable, so never try to build a library.

## Essential Commands

### Database Operations

```bash
yarn db:generate         # Generate Prisma client
```

## Architecture Patterns

1. **Feature-based modules**: Each major feature (query, deploy, etc.) is a separate library in `libs/features/`
2. **Shared types**: TypeScript types are centralized in `libs/types/` and shared between frontend and backend
3. **UI component library**: Reusable components in `libs/ui/` using Emotion for styling
4. **API-first design**: Clear separation between frontend and backend with typed API contracts
5. **Salesforce integration**: Core Salesforce API logic isolated in `libs/salesforce-api/`

## Development Notes

- **Authentication**: Set `EXAMPLE_USER_OVERRIDE=true` in `.env` to skip auth locally (visit `/app` directly)
- **Database**: Uses PostgreSQL with Prisma ORM. Migrations in `prisma/migrations/`
- **State Management**: Frontend uses jotai for global state
- **Styling**: Emotion CSS-in-JS with Salesforce Lightning Design System
- **Real-time**: Socket.io for platform events and real-time updates

## Coding standards

- Make decisions that favor future code readability
- Add function level or block level comments where it adds to code readability, skip it for trivial functions or things where the function name explains everything a developer would ever need to know
- For logic (e.g. within a function) don't add trivial comments to every line for no reason, only add comments where warranted to aid in future understanding "at a glance"
- Avoid if statements without curly brackets

```typescript
// ❌ DON'T DO THIS
if (true) return x;

// ✅ DO THIS
if (true) {
  return x;
}
```

- Avoid single letter variable names and prefer verbose variables names except for `i` as in index.
  - e.g. `providers.map(provider => provider.value)`
- Prefer destructuring while looping where it makes sense to avoid having to choose a variable name (favor clarity if needed)
  - e.g. `providers.map(({value}) => value)`
- Always run prettier after working on a code file

## Imports

Never import anything cross-module, always use imports defined in `tsconfig.base.json`

This project does NOT use `@salesforce/design-system-react`, all components were built by hand and generally come from `@jetstream/ui`.

Prefer using Salesforce lightning design system CSS classes when applicable, but can use `import { css } from '@emotion/react'` where needed.

## Testing Approach

- Unit tests with Vitest (co-located with source files, but in a `__tests__` folder example: `__tests__/*.spec.ts`)
- E2E tests with Playwright in `apps/*-e2e/` directories
- Always run linting: `yarn lint:affected`
- Always ensure that there are no type errors

## Common Development Tasks

### Working with Database

Never create migration files unless explicitly asked to.
If you are asked to create a migration file, always use the prisma cli and never create them manually.

After updating the DB schema, generate types.

If needed, you can apply the DB changes using `yarn prisma db push` so that we can test and iterate prior to creating the migration

```bash
yarn db:generate        # Regenerate Prisma client after schema changes
```

### Adding New Features

1. Generate new library: `yarn nx generate @nx/react:library --directory=libs/features/feature-name --name=feature-name --component=false --importPath=@jetstream/feature/feature-name --tags=scope:browser --no-interactive`
2. Export from library's index.ts
3. Import in apps as `@jetstream/feature/feature-name`

## Key Files to Understand

- `apps/api/src/app/app.module.ts` - Main backend module setup
- `apps/jetstream/src/app/App.tsx` - Main frontend app component
- `libs/shared/ui-utils/src/lib/api-config.ts` - API configuration
- `prisma/schema.prisma` - Database schema
- `nx.json` - Nx workspace configuration

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors

<!-- nx configuration end-->
