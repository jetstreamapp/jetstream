# Accessibility Program (WCAG 2.1 AA)

Jetstream targets **WCAG 2.1 Level AA** using commercially reasonable efforts, and can produce an
Accessibility Conformance Report (ACR, using the ITI **VPAT 2.5 WCAG** template) on request.
This directory holds the audit evidence, findings, and the conformance report.

## Layout

- `audit-<year>/findings.md` — the findings log: every audit finding with WCAG criterion, severity, and status.
- `vpat/` — the authored conformance report (`jetstream-acr-<date>.md`) and exported copies delivered to customers.
- Raw axe-core scan evidence is generated into `apps/jetstream-e2e/a11y-results/` (gitignored) and uploaded
  as the `a11y-results-*` CI artifacts on every E2E run.

## Scope

The primary scope is the **Jetstream web application**, which includes the Electron **desktop app**
(same React components from `libs/ui` + `libs/features`). The landing/auth site, docs site, and
browser extension are secondary surfaces covered by spot scans and noted separately in the ACR.

## Automated checks

| Layer           | What                                                                                                            | How to run                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| E2E page sweep  | axe-core WCAG 2.1 A/AA scan of every app route + key interactive states                                         | `pnpm playwright:test:a11y` (needs the E2E server; runs in CI inside the e2e shards) |
| Static surfaces | axe scan of arbitrary URLs (landing, docs)                                                                      | `pnpm a11y:scan-urls <baseUrl> <paths...>` or `--sitemap`                            |
| Component tests | `axeScan()` from `@jetstream/test-utils` in Vitest specs (see `libs/ui/src/lib/modal/__tests__/Modal.spec.tsx`) | `pnpm nx run ui:test`                                                                |
| Lint            | oxlint `jsx-a11y` plugin (`.oxlintrc.json`)                                                                     | `pnpm lint`                                                                          |

## The baseline ratchet

E2E scans gate against `apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json`:

- A scan key **not** in the baseline is record-only (never fails CI) — new scans are safe to add.
- A scan key **in** the baseline fails CI only when a **new** serious/critical axe rule violation
  appears that isn't already baselined.
- After a full run, `pnpm a11y:merge-baseline [resultsDirs...]` regenerates the baseline from the
  results. The baseline should only ever shrink as findings are remediated — review the diff.

Lint follows the same ratchet idea: `jsx-a11y` rules currently at `warn` in `.oxlintrc.json` are
promoted to `error` once their violation count reaches zero (see the census in the findings log).

## Manual audit

Automated tooling covers roughly a third of WCAG. Each audit cycle also includes, per representative flow:

1. **Keyboard-only**: complete the task with no pointer; no traps, visible focus, sane order, Esc closes overlays.
2. **Screen reader**: VoiceOver (macOS) pass; names/roles/values, live-region announcements, form errors.
3. **Visual**: 200% zoom, 320px reflow (1.4.10), text-spacing override (1.4.12), contrast spot checks, `prefers-reduced-motion`.

Record everything in the findings log, then update the VPAT.

## Cadence

Refresh the ACR annually and after major UI changes. The CI artifacts make the automated half of a
refresh nearly free; the manual pass is the real work.
