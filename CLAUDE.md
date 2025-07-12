# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Commands

- `yarn` - Install all dependencies
- `yarn start` - Start frontend React development server (http://localhost:4200/app)
- `yarn start:api` - Start backend API server (http://localhost:3333)

### Build Commands

- `yarn build` - Full production build (includes db:generate, build:core, build:landing, generate:version)
- `yarn build:core` - Build main applications (jetstream, api, download-zip-sw)
- `yarn build:client` - Build frontend React application only
- `yarn build:api` - Build backend API only
- `yarn build:landing` - Build landing page
- `yarn build:desktop` - Build desktop Electron application

### Testing and Quality

- `yarn test` - Run tests
- `yarn test:all` - Run all tests across all projects
- `yarn test:affected` - Run tests for affected projects only
- `yarn lint:all` - Lint all projects
- `yarn lint:affected` - Lint affected projects only
- `yarn format` - Format code with Prettier

### Database Commands

- `yarn db:generate` - Generate Prisma client
- `yarn db:migrate` - Deploy database migrations
- `yarn db:seed` - Seed database with required data

### Development Setup

1. Copy `.env.example` to `.env` or run `yarn scripts:generate-env`
2. Install PostgreSQL and create a database named `postgres`
3. Run `yarn` to install dependencies
4. Run `yarn db:generate && yarn db:migrate && yarn db:seed` to set up database
5. For development: Run `yarn start:api` in one terminal and `yarn start` in another

## Architecture

Jetstream is a monorepo built with Nx that provides a comprehensive Salesforce data management platform.

### Application Structure

- **Frontend**: React application (`apps/jetstream`) using Vite, Emotion for styling, and Recoil for state management
- **Backend**: Node.js API server (`apps/api`) built with Express and Prisma ORM
- **Desktop**: Electron application (`apps/jetstream-desktop*`) that wraps the web application
- **Web Extension**: Browser extension (`apps/jetstream-web-extension`) for Salesforce integration
- **Documentation**: Docusaurus site (`apps/docs`) and Next.js landing page (`apps/landing`)

### Key Libraries and Features

- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: OAuth2 with Salesforce, custom authentication system
- **UI Components**: Custom component library in `libs/ui` with Salesforce Lightning Design System
- **Salesforce Integration**: Comprehensive Salesforce API library in `libs/salesforce-api`
- **Features**: Modular feature libraries in `libs/features/*` including:
  - Query builder and data manipulation
  - Metadata deployment and management
  - Record loading and bulk operations
  - Permission management
  - Formula evaluation
  - Anonymous Apex execution

### Library Organization

- `libs/features/*` - Feature-specific modules (query, deploy, load-records, etc.)
- `libs/shared/*` - Shared utilities and core UI components
- `libs/ui` - Main UI component library
- `libs/types` - TypeScript type definitions
- `libs/salesforce-api` - Salesforce API integration
- `libs/prisma` - Database utilities and schemas

### Development Notes

- Uses TypeScript throughout with strict type checking
- Nx workspace with path mappings defined in `tsconfig.base.json`
- Component library uses Storybook for development and documentation
- E2E testing with Playwright
- Supports Docker deployment with provided Dockerfile and docker-compose.yml (generally not used, so don't worry about it)

### Environment Variables

The application requires various environment variables for Salesforce OAuth, database connection, and other services. Use `yarn scripts:generate-env` to set up a basic `.env` file, or copy from `.env.example`.

Assume this is set up and don't try to do anything with environment variables unless explicitly asked to.

### Testing

- Unit tests with Jest for most libraries and applications
- E2E tests with Playwright in `apps/jetstream-e2e`
- Test environment setup includes database seeding and mock data
