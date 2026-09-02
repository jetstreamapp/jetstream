# Accessibility Program (WCAG 2.1 AA)

Jetstream targets **WCAG 2.1 Level AA** using commercially reasonable efforts, and can produce an
Accessibility Conformance Report (ACR, using the ITI **VPAT 2.5 WCAG** template) on request.
This directory holds the audit evidence, findings, and the conformance report.

## Layout

- `audit-<year>/findings.md` — the findings log: every audit finding with WCAG criterion, severity, and status.
- `audit-<year>/manual-checklist.md` — the keyboard / screen reader / visual pass procedure and the per-flow pass evidence.
- `vpat/` — the authored conformance report (`jetstream-acr-<date>.md`) and exported copies delivered to customers.
- Raw axe-core scan evidence is generated into `apps/jetstream-e2e/a11y-results/` (gitignored) and uploaded
  as the `a11y-results-*` CI artifacts on every E2E run.

## Scope

The primary scope is the **Jetstream web application**, which includes the Electron **desktop app**
(same React components from `libs/ui` + `libs/features`). The landing/auth site and docs site are
secondary surfaces scanned with `pnpm a11y:scan-urls` (the 17 landing/auth pages are baselined; the
docs sitemap is scanned on demand). The **browser extension** renders the same app shell and
components (`SkipToContent` + `AppMainContent` like the other shells) but has no automated scan of
its own yet — it is noted separately in the ACR.

## Automated checks

| Layer           | What                                                                                                                                                                                                 | How to run                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| E2E page sweep  | axe-core WCAG 2.1 A/AA scan of every app route + key interactive states                                                                                                                              | `pnpm playwright:test:a11y` (needs the E2E server; runs in CI inside the e2e shards) |
| Static surfaces | axe scan of arbitrary URLs (landing, docs)                                                                                                                                                           | `pnpm a11y:scan-urls <baseUrl> <paths...>` or `--sitemap`                            |
| Component tests | `axeScan()` from `@jetstream/test-utils` (WCAG 2.1 A/AA rules) — required in the spec of every new or changed interactive `libs/ui` component (see `libs/ui/src/lib/modal/__tests__/Modal.spec.tsx`) | `pnpm nx run ui:test`                                                                |
| Lint            | oxlint `jsx-a11y` plugin (`.oxlintrc.json`)                                                                                                                                                          | `pnpm lint`                                                                          |

## The baseline ratchet

E2E scans gate against `apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json`, a
`Record<scanKey, Record<ruleId, nodeCount>>`: per scan key, the serious/critical axe rules it is still
allowed to violate and how many nodes each may flag, e.g. `"route-CREATE_FIELDS": { "nested-interactive": 53 }`.

- **Every scan key must be present.** A scan whose key is missing fails with a message telling you to
  add `"<key>": {}` — an empty entry gates that scan at zero serious/critical violations. New routes
  and interactive states are therefore baselined explicitly; nothing runs record-only.
- A scan fails when a serious/critical rule fires that is not in its entry, or when a baselined rule
  flags **more nodes** than its count allows (node-level ratchet). A lower count is logged as a hint
  to ratchet the baseline down.
- After a full run, `pnpm a11y:merge-baseline [--allow-growth] [resultsDirs...]` folds the results
  back in: lower counts, rules that stopped firing and new keys are written; keys absent from the
  results are kept unchanged, so a partial run never drops gating. The script refuses to write when a
  results directory is missing or zero result files were found, and it refuses any **growth** — a
  rule missing from an entry, a higher node count, or a new key that already carries violations —
  unless `--allow-growth` is passed deliberately, after the finding has been logged in the findings
  file.

Lint follows the same ratchet idea: `jsx-a11y` rules currently at `warn` in `.oxlintrc.json` are
promoted to `error` once their violation count reaches zero (see the census in the findings log);
rules already at `error` are never demoted.

## Manual audit

Automated tooling covers roughly a third of WCAG. Each audit cycle also includes, per representative flow:

1. **Keyboard-only**: complete the task with no pointer; no traps, visible focus, sane order, Esc closes overlays.
2. **Screen reader**: VoiceOver (macOS) pass; names/roles/values, live-region announcements, form errors.
3. **Visual**: 200% zoom, 320px reflow (1.4.10), text-spacing override (1.4.12), contrast spot checks, `prefers-reduced-motion`.

Record everything in the findings log, then update the VPAT.

## Cadence

Refresh the ACR annually and after major UI changes. The CI artifacts make the automated half of a
refresh nearly free; the manual pass is the real work.
