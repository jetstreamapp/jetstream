# Repository Guidelines

## Project Structure & Module Organization

- Monorepo managed by Nx. Key folders:
  - `apps/`: runnable apps (e.g., `api`, `jetstream`, `landing`, `desktop`, `web-extension`, `e2e suites`).
  - `libs/`: shared libraries (UI, types, features, prisma helpers, etc.).
  - `prisma/`: schema, migrations, seeds.
  - `scripts/`: project automation (release, env generation, assets).
  - `dist/`: build outputs (do not edit, generally ignore this folder unless specifically asked about something within it).
- Prefer co-locating code and tests. ALWAYS Import via package/tsconfig paths, not deep relative paths across projects.
  - Paths are located in the root `tsconfig.base.json` if a reference is needed

## Build, Test, and Development Commands

- Install/setup: `yarn` → `yarn scripts:generate-env` → `yarn db:generate`.
  - AI Agent will never need to use these commands
- Run locally:
  - API: `yarn start:api` (http://localhost:3333)
  - Frontend: `yarn start` (http://localhost:4200)
  - Landing: `yarn build:landing` (once), then development servers as above.
- Build: `yarn build` (core apps, production config). Affected-only: `yarn build:affected`.
  - for frontend only changes, can use `yarn build:client`
  - for server only changes, can use `yarn build:api`
- Database: `yarn db:migrate` · `yarn db:seed`.
- Test: unit `yarn test` (or `yarn test:all`), E2E `yarn e2e`, Playwright `yarn playwright:test`.
- Lint/format: `yarn lint:all` · `yarn format:write` · `yarn format:check`.

## Coding Style & Naming Conventions

- Language: TypeScript-first. Use 2-space indentation; let Prettier enforce style.
- Tools: ESLint (`eslint.config.js`) and Prettier (`.prettierrc`). Fix before committing.
- Naming: kebab-case for app/lib names; `camelCase` variables/functions; `PascalCase` React components; test files `*.spec.ts` or `*.test.ts` co-located.
- Respect Nx module boundaries; avoid deep imports between libs/apps.

## Testing Guidelines

- Frameworks: Jest/Vitest for unit tests (Nx), Playwright for E2E.
- Location: co-locate next to sources in `apps/*` or `libs/*`.
- Run all tests locally: `yarn test:all`. CI enables coverage for Jest targets.
- E2E base URLs: 3333 (API) and 4200 (frontend). Use Playwright configs in `apps/*-e2e`.

## Commit & Pull Request Guidelines

- Flow: branch from `main`, open PR early. Keep diffs focused and atomic.
- Commits: prefer Conventional Commits, e.g., `feat(api): add user endpoint`, `fix(ui): guard null state`.
- PRs: include description, linked issues, screenshots for UI, and test notes. Ensure lint, tests, and `yarn build` pass.

## Security & Configuration Tips

- Secrets live in `.env` (generated via `yarn scripts:generate-env`); never commit secrets. Prisma generates code via `yarn db:generate`.
- Tooling versions: Node per `.nvmrc`/`package.json` engines (Node 22, Yarn 1.x). Use `nvm use` to match.
