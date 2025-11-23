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

## Essential Commands

### Development Setup

```bash
yarn                     # Install dependencies
yarn init:project        # Initialize .env file
yarn db:generate         # Generate Prisma client
yarn db:migrate          # Run database migrations
yarn db:seed             # Seed database with initial data
```

### Development Servers

```bash
# Core development (run in separate terminals)
yarn start:api          # Backend API (http://localhost:3333)
yarn start              # Frontend dev server (http://localhost:4200)

# Optional services
yarn start:desktop:client # Desktop app renderer
yarn start:desktop      # Desktop app main process

# Web extension
yarn start:web-ext:watch   # Watch mode for extension
yarn start:web-ext:chrome  # Run in Chrome
yarn start:web-ext:firefox  # Run in Firefox
```

### Building

```bash
yarn build               # Build all core apps
yarn build:client        # Build frontend only
yarn build:api           # Build backend only
yarn build:desktop       # Build desktop app
yarn build:web-extension # Build browser extension
```

### Testing & Quality

```bash
# Run tests
yarn test [project]     # Test specific project
yarn test:all           # Test all projects
yarn test:affected      # Test affected by changes

# Linting
yarn lint:all          # Lint all projects
yarn lint:affected     # Lint affected projects

# E2E tests
yarn playwright:test   # Run Playwright tests
yarn e2e               # Run E2E tests

# Format code
yarn format           # Auto-format code
```

### Nx Commands

```bash
yarn nx dep-graph      # View dependency graph
yarn nx affected:build # Build affected projects
yarn nx affected:test  # Test affected projects
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
- Avoid single letter variable names and prefer verbose variables names except for `i` as in index.
  - e.g. `providers.map(provider => provider.value)`
- Prefer destructuring while looping where it makes sense to avoid having to choose a variable name (favor clarity if needed)
  - e.g. `providers.map(({value}) => value)`

## Imports

Never import anything cross-module, always use imports defined in `tsconfig.base.json`

This project does NOT use `@salesforce/design-system-react`, all components were built by hand and generally come from `@jetstream/ui`.

Prefer using Salesforce lightning design system CSS classes when applicable, but `import { css } from '@emotion/react'` where needed.

## Testing Approach

- Unit tests with Vitest (co-located with source files as `*.spec.ts`)
- E2E tests with Playwright in `apps/*-e2e/` directories
- Run affected tests before committing: `yarn test:affected`
- Always run linting: `yarn lint:affected`

## Common Development Tasks

### Working with Database

```bash
yarn db:generate        # Regenerate Prisma client after schema changes
yarn db:migrate        # Apply pending migrations
npx prisma studio      # Open database GUI
```

### Adding New Features

1. Generate new library: `yarn nx generate @nx/react:library --directory=libs/feature/feature-name --name=feature-name --component=false --importPath=@jetstream/features/feature-name --tags=scope:browser --no-interactive`
2. Export from library's index.ts
3. Import in apps as `@jetstream/features/feature-name`

### Debugging

- Backend: Start with `yarn start:api` and attach debugger to port 9229
- Frontend: Use browser DevTools with source maps
- Desktop: `yarn start:desktop` with `--inspect=9229`

## Key Files to Understand

- `apps/api/src/app/app.module.ts` - Main backend module setup
- `apps/jetstream/src/app/App.tsx` - Main frontend app component
- `libs/shared/ui-utils/src/lib/api-config.ts` - API configuration
- `prisma/schema.prisma` - Database schema
- `nx.json` - Nx workspace configuration
