# Copilot code review instructions for Jetstream

Jetstream is a private Nx monorepo (React 19 + Vite web app, Express/Prisma API, Electron desktop, browser extension). Keep reviewing rigorously for real correctness bugs, security issues, accessibility, and missing test coverage — those catches are valuable. The notes below remove recurring noise; they do not lower the bar on genuine bugs.

## Project facts that change how to review

- **All `@jetstream/*` libraries are internal-only.** They are TypeScript path-mapped via `tsconfig.base.json`, have no `package.json`, and are never published to npm. Do NOT flag renames or signature changes as "breaking changes for external consumers" and do NOT ask for deprecated back-compat aliases — there are no external consumers.
- **Formatting and imports are auto-enforced.** Prettier (`nx format`) and an organize-imports step run on every change. Do NOT comment on whitespace, trailing commas, quote style, line length, or import ordering/grouping.
- **`copyToClipboard` never rejects.** It is the default export of the `copy-to-clipboard` package (v4), which returns a boolean synchronously and swallows its own internal errors. Do NOT flag a missing `.catch`/`try` (or an `await`) around it as a potential unhandled rejection.
- **Validation uses zod v4.** `.default(x)` and `.prefault(x)` infer the _same_ required type via `z.infer` (the output type); they differ only in runtime parsing, not in whether a field is optional at call sites. Don't suggest swapping one for the other to change call-site optionality.
- **Client-side checks are UX hints; the server is authoritative.** Client-side signatures/permission checks (e.g. feature flags) exist for tamper-evidence and display only. Don't escalate a client-only check to a security vulnerability unless the corresponding server-side gate is actually missing.

## House conventions (so suggestions match the codebase)

- This repo enables the `eslint-plugin-react-hooks` rules (exhaustive-deps, set-state-in-effect, refs). Don't suggest stashing the "latest" handler/value in a mutable ref to drop it from a dependency array — it conflicts with those rules and our readability preference. Genuine stale-closure bugs are still worth raising.
- Prefer existing shared constants/enums over hard-coded strings (e.g. `TEAM_MEMBER_STATUS_ACTIVE`, `TeamStatusSchema.enum.ACTIVE`), and route paths via the `APP_ROUTES` constants from `@jetstream/shared/ui-router` — never hardcode route strings.
- Import only via the `@jetstream/*` aliases in `tsconfig.base.json`; never deep cross-module imports. Nx `enforce-module-boundaries` already guards scope tags (scope:server/browser/shared/type-only).
- UI is hand-built — this repo does NOT use `@salesforce/design-system-react`. Prefer SLDS CSS classes; use Emotion `css` where needed. State is jotai atoms.
- Always use curly braces on `if` statements. Prefer verbose variable names (except `i` for index); avoid single-letter names.
- Tests are Vitest, co-located in `__tests__/*.spec.ts`. Migrations are created with the Prisma CLI only.
