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
**Build**: Nx monorepo, Vitest (testing), Playwright (E2E), oxlint (linting), oxfmt (formatting)

## Important Project Build Notes

NONE of the libraries are buildable, so never try to build a library.

This repo is pinned to pnpm via `devEngines.packageManager`. Always run Nx (and any other tooling) through pnpm — `pnpm nx run <project>:<target>`, `pnpm nx run-many`, `pnpm nx affected`. Do NOT use `npx nx ...`: `npx` invokes npm, which fails the engine check with `EBADDEVENGINES Invalid devEngines.packageManager`.

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
- Always run `pnpm format` (oxfmt) after working on a code file
- Always run organize-imports on any TypeScript files (`.ts`/`.tsx`/`.mts`/`.cts`) you modified, just like the formatter. This invokes the TypeScript language server's "Organize Imports" action — the same one VSCode runs on save — and is NOT a lint rule.
  - `pnpm organize-imports <files-or-globs...>` — sort, combine, and remove unused imports in place
  - `pnpm organize-imports:check <files-or-globs...>` — dry-run; exits non-zero if any file would change

## Imports

Never import anything cross-module, always use imports defined in `tsconfig.base.json`

This project does NOT use `@salesforce/design-system-react`, all components were built by hand and generally come from `@jetstream/ui`.

Prefer using Salesforce lightning design system CSS classes when applicable, but can use `import { css } from '@emotion/react'` where needed.

## Accessibility

The product targets WCAG 2.1 AA — program docs, findings log, and the conformance report live in `docs/accessibility/`. Run the `/a11y-review` skill on any change that adds or modifies interactive UI before calling it done.

- New or changed interactive UI must be keyboard operable with correct ARIA (names, roles, states) and managed focus: when a control unmounts on activation, move focus to its replacement or the trigger, never let it fall to `body`. Reference implementations: `libs/ui/src/lib/modal/Modal.tsx`, `popover/Popover.tsx`, `form/dropdown/DropDown.tsx`, `list/List.tsx`, and the grid under `data-table/grid/`.
- Use the shared primitives instead of hand-rolling: `ariaDisabledButtonProps` for a control that disables itself, `AssistiveStatus` / `useAnnouncer` / `ScopedNotification` for status a screen reader must hear, `useEscapeToCloseLayer` for anything Escape closes, and the roving-tabindex composites (`List`, `Tabs`, `Accordion`, `Tree`, the grid) for long collections — never a tab stop per row.
- Add an `axeScan()` assertion (from `@jetstream/test-utils`) to specs for interactive `libs/ui` components — see `libs/ui/src/lib/modal/__tests__/Modal.spec.tsx`.
- `pnpm a11y:lint-ratchet` runs in pre-commit and CI. It fails on any new `warn`-tier `jsx-a11y` hit (per file and rule, baselined in `tools/oxlint/jsx-a11y-baseline.json`), a new `libs/ui` spec without `axeScan()`, and a new `APP_ROUTES` entry without an `a11y-baseline.json` key. `--update` shrinks the baseline; growth needs `--allow-growth` plus a findings-log entry. E2E axe scans in `apps/jetstream-e2e/src/tests/a11y/` ratchet the same way, and `jsx-a11y` rules are never demoted from `error`.

## Testing Approach

- Unit tests with Vitest (co-located with source files, but in a `__tests__` folder example: `__tests__/*.spec.ts`)
- E2E tests with Playwright in `apps/*-e2e/` directories
- Always ensure that there are no type errors

### Running web E2E tests locally

Use `pnpm e2e:local` — it builds api/jetstream/landing (nx cache applies), starts the built server on an isolated port (3322 by default, so it never conflicts with `start:api` on 3333 or the Vite dev server on 4200), runs Playwright headless, and shuts the server down. No `.env` changes are needed. Requires a running local postgres; by default the run shares the dev database, or pass `--db <postgres-uri>` (or set `E2E_POSTGRES_DBURI` in `.env`) to use a dedicated database — it is created, migrated and seeded automatically.

```bash
pnpm e2e:local                        # full suite
pnpm e2e:local query-results.spec.ts  # one spec (auth setup still runs first)
pnpm e2e:local query                  # folder filter — everything under src/tests/query
pnpm e2e:local --grep "load records"  # unknown args pass through to `playwright test`
pnpm e2e:local --skip-build           # reuse the existing dist build
```

Spec filters are regexes matched against test file paths (see `apps/jetstream-e2e/src/tests/` for the actual filenames — e.g. there is no `query.spec.ts`, the specs are `query-builder`, `query-editor` and `query-results`).

Server logs go to `dist/e2e-server.log`; traces, screenshots and `error-context.md` files for failures land in `dist/.playwright/apps/jetstream-e2e/test-output`. Known pre-existing flake: the query-builder nested-subquery tests ("Filter child objects" timeout) fail intermittently on main — not caused by your changes.

## Common Development Tasks

### Working with Database

Never create migration files unless explicitly asked to.
If you are asked to create a migration file, always use the prisma cli and never create them manually.

After updating the DB schema, generate types.

```bash
pnpm db:generate # Regenerate Prisma client after schema changes
```

### Calling the Salesforce API

If you need real data from a Salesforce org (verify a describe result, check field metadata, test a query),
use `pnpm sf:api` (`scripts/sf-api.mjs`). It authenticates with the JWT bearer flow using the `SF_LOCAL_*`
variables in `.env`, so there is no interactive login. Run `pnpm sf:api --help` for the full command list.

```bash
pnpm sf:api query "SELECT Id, Name FROM Account LIMIT 5"
pnpm sf:api get sobjects/Account/describe
pnpm sf:api query "SELECT Id, Name FROM ApexClass" --tooling
```

This targets a personal dev org, so it is safe to create and modify records there.

### Writing documentation (apps/docs)

Docusaurus 3 admonitions must never have a space-separated title. `:::tip Some Title` silently renders
the entire block as literal text (the build does not fail). Write plain `:::tip`, or use the bracket
form `:::tip[Some Title]` when a title is needed. `pnpm --dir apps/docs lint` checks for this, and the
docs build runs the same check.

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
