## Project Overview

Jetstream is a comprehensive Salesforce management platform that helps users work with Salesforce data and metadata more efficiently. It consists of:

- Web application (React + Vite)
- Backend API (Node.js + Express)
- Desktop application (Electron)
- Browser extension (Chrome/Firefox)
- Landing page (next JS) and documentation (Docusaurus) sites

## Key Technologies

**Frontend**: React 19, TypeScript, Vite, jotai (state), Emotion (styling), Monaco Editor, Salesforce Lightning Design System (SLDS)
**Backend**: Node.js 22+, Express, Prisma ORM, PostgreSQL, Socket.io, in-house auth
**Build**: Nx monorepo, Vitest (testing), Playwright (E2E), ESLint, Prettier

## Important Project Build Notes

NONE of the libraries are buildable, so never try to build a library.

## Coding standards

- Make decisions that favor future code readability
- Add function level or block level comments only where it adds to code readability, skip it for trivial functions or things where the function name explains everything a developer would ever need to know
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
  - e.g. `providers.map(({ value }) => value)`
- Always run prettier after working on a code file

## Imports

Never import anything cross-module, always use imports defined in `tsconfig.base.json`

This project does NOT use `@salesforce/design-system-react`, all components were built by hand and generally come from `@jetstream/ui`.

Prefer using Salesforce lightning design system CSS classes when applicable, but can use `import { css } from '@emotion/react'` where needed.

## Testing Approach

- Unit tests with Vitest (co-located with source files, but in a `__tests__` folder example: `__tests__/*.spec.ts`)
- E2E tests with Playwright in `apps/*-e2e/` directories
- Always ensure that there are no type errors

## Common Development Tasks

### Working with Database

Never create migration files unless explicitly asked to.
If you are asked to create a migration file, always use the prisma cli and never create them manually.

After updating the DB schema, generate types.

```bash
yarn db:generate # Regenerate Prisma client after schema changes
```

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
