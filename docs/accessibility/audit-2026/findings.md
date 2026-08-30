# Accessibility Audit Findings — 2026

Status of every known WCAG 2.1 AA finding. Severity definitions:

- **P1 (material)**: blocks or substantially impairs task completion for assistive-technology or keyboard users. These are the "material accessibility defects" in customer agreements.
- **P2**: degrades the experience but a workaround exists.
- **P3**: best-practice / polish; no significant user impact.

Statuses: `open` → `in-progress` → `fixed (PR #)` | `accepted` (documented rationale, revisit annually).

## Component findings (from code survey, 2026-08-26 — each needs manual verification before the VPAT is finalized)

| #   | Finding                                                                                                     | WCAG         | Severity | Where                                                                            | Status                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------ | -------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| C1  | Combobox never sets `aria-activedescendant`; active option is not announced during arrow-key navigation     | 4.1.2        | P1       | `libs/ui/src/lib/form/combobox/Combobox.tsx`                                     | fixed — focus lands on the `role="option"` element itself (was on a `role="presentation"` li, so nothing was announced) |
| C2  | Tabs have correct roles but no arrow-key roving tabindex                                                    | 2.1.1        | P1       | `libs/ui/src/lib/tabs/Tabs.tsx`                                                  | fixed — roving tabindex + orientation-aware Arrow/Home/End with automatic activation                                    |
| C3  | TimePicker has no ARIA attributes and no keyboard handling                                                  | 2.1.1, 4.1.2 | P1       | `libs/ui/src/lib/form/time-picker/TimePicker.tsx`                                | re-scoped — TimePicker is a thin Picklist wrapper and inherits its (fixed) combobox semantics; verify via manual audit  |
| C4  | No skip link in any user-facing app                                                                         | 2.4.1        | P1       | app shells (web, desktop, landing, extension)                                    | fixed — `SkipToContent` in web + desktop shells and landing layout (extension deferred)                                 |
| C5  | Input/Select don't set `aria-invalid`; error association depends on the caller                              | 3.3.1, 4.1.2 | P1       | `libs/ui/src/lib/form/input/Input.tsx`, `form/select/Select.tsx`                 | fixed — Input/Select stamp `aria-invalid` + error `aria-describedby` onto native control children                       |
| C6  | Toast uses bare `role="status"`; no `aria-atomic`, no dismissal-timing consideration                        | 4.1.3, 2.2.1 | P2       | `libs/ui/src/lib/toast/Toast.tsx`                                                | fixed — errors are `role="alert"`/assertive, others polite, `aria-atomic` on all                                        |
| C7  | DatePicker popup/trigger ARIA contract is thin (DateGrid itself has roving focus)                           | 4.1.2        | P2       | `libs/ui/src/lib/form/date/DatePicker.tsx`                                       | fixed — trigger has `aria-haspopup`/`aria-expanded`, popup is a labeled dialog, format hint associated to the input     |
| C8  | Expression builder drag-and-drop (dnd-kit) keyboard alternative unverified                                  | 2.1.1        | P2       | `libs/ui/src/lib/expression-group/`                                              | open                                                                                                                    |
| C9  | Monaco editor needs `accessibilitySupport` configuration and a documented Esc-to-escape-tab-trap affordance | 2.1.2        | P2       | `libs/shared/ui-core/src/app/MonacoEditor.tsx`                                   | open                                                                                                                    |
| C10 | Virtualized lists/grid: verify aria-rowcount vs rendered rows and off-screen focus targets                  | 4.1.2        | P2       | `libs/ui/src/lib/form/combobox/ComboboxWithItemsVirtual.tsx`, `data-table/grid/` | open                                                                                                                    |

## Accepted findings

| #   | Finding                                                                                                                       | Rationale                                                                                                                                                                      | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| A1  | Floating UI focus-guard sentinels (`<span role="button">` with no accessible name) trip axe `button-name`/`aria-command-name` | Library-internal focus redirectors; focus never rests on them. Filtered in `axeScan()` (`libs/test-utils/src/lib/a11y-test-utils.ts`). Revisit on @floating-ui/react upgrades. | accepted |

## Lint census (oxlint jsx-a11y warn-tier rules, 2026-08-26)

137 warnings across 67 files. Promote each rule to `error` in `.oxlintrc.json` when its count hits zero.

| Rule                                          | Count               |
| --------------------------------------------- | ------------------- |
| click-events-have-key-events                  | 47                  |
| no-static-element-interactions                | 39                  |
| control-has-associated-label                  | 18                  |
| no-noninteractive-element-interactions        | 14                  |
| no-noninteractive-element-to-interactive-role | 12                  |
| interactive-supports-focus                    | 3                   |
| autocomplete-valid                            | 3                   |
| label-has-associated-control                  | 1                   |
| no-redundant-roles                            | 0 — **promote now** |

## Automated scan findings (axe, 2026-08-26 — 30 scans: 26 routes + 4 interactive states)

Initial sweep: 89 baselined serious/critical rule entries across 30 scans, but only 11 distinct
rules, and the two critical ones that appear on **every** page traced to a handful of shared
components. **After the first remediation pass (2026-08-26) the baseline is down to 10 entries and
zero critical violations remain** — see per-finding status below.

| #   | axe rule                                                                        | Impact   | Where seen   | Root cause                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Severity |
| --- | ------------------------------------------------------------------------------- | -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| X1  | `aria-valid-attr-value`                                                         | critical | all 30 scans | Combobox input `aria-controls` references the listbox id while the listbox is closed/not in the DOM (7 variants, all `libs/ui` Combobox — incl. the header org selector). Set `aria-controls` only when open, or keep the listbox rendered. **Fixed** — conditional `aria-controls` in Combobox, Picklist, FormGroupDropdown.                                                                                                                               | P1       |
| X2  | `button-name`                                                                   | critical | all 30 scans | Icon-only `slds-button_icon` buttons with no accessible name — 13 distinct elements (org info popover trigger, dropdown triggers, row action buttons). Add `aria-label`/assistive text; audit the shared Icon-button call sites. **Fixed** — root fix in `Icon` (omitContainer + description now yields role="img" + aria-label, removing the baked-in aria-hidden) plus explicit labels on grid row actions, header popovers, list filter/refresh buttons. | P1       |
| X3  | `aria-input-field-name`                                                         | serious  | 13 scans     | `<ul role="listbox" tabindex="0">` (sobject/List component) has no accessible name — add `aria-label`. **Fixed** — `List` accepts `ariaLabel`, wired at all call sites; `ListItemCheckbox` now labels its checkbox from the heading (was `label=""`).                                                                                                                                                                                                       | P1       |
| X4  | `nested-interactive`                                                            | serious  | 5 scans      | Draggable org card fixed (dedicated drag handle carries dnd-kit's button role). Remaining (the only baselined rule, 3 pages): `ListItem` rows with `itemTrailingRenderer` popover triggers inside `role="option"` — needs a design decision: move the trailing action out of the option, or drop listbox semantics for those lists.                                                                                                                         | P2       |
| X5  | `label` / `select-name`                                                         | critical | 4 scans      | A few raw inputs/selects without an associated label (e.g. number input on grid pagination, columns select on Platform Events). **Fixed** — SOQL format inputs associated via ids, record-form columns select and billing plan radios labeled.                                                                                                                                                                                                              | P1       |
| X6  | `definition-list`                                                               | serious  | 3 scans      | `<dl>` with invalid structure (Home/Team dashboard summary lists).                                                                                                                                                                                                                                                                                                                                                                                          | P3       |
| X7  | `aria-command-name`, `aria-progressbar-name`, `link-name`, `link-in-text-block` | serious  | 1 scan each  | One-off unnamed controls (debug-log button, load progressbar, field "view in Salesforce" link, template link styled as plain text). **Mostly fixed** — progressbars, debug-log buttons/cells, formula/platform-event/fields-list icons labeled; `link-in-text-block` (template link styling) and one residual `aria-command-name` cell remain.                                                                                                              | P2       |

Full per-page evidence: `apps/jetstream-e2e/a11y-results/*.json` (regenerate with `pnpm playwright:test:a11y`).

## Secondary surfaces (landing + docs, axe scan 2026-08-26)

226 pages scanned (`pnpm a11y:scan-urls`): all ~210 docs content pages plus 17 landing/auth pages.

| #   | Finding                                                                                                                                     | WCAG  | Severity | Where                                                     | Status                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| L1  | `<html>` missing `lang` attribute on every landing/auth page                                                                                | 3.1.1 | P1       | `apps/landing/pages/_document.js`                         | fixed — `<Html lang="en">`                                                                                |
| L2  | `color-contrast` on footer headings (`text-gray-400` uppercase) and similar muted text — 11 pages (landing marketing pages + docs homepage) | 1.4.3 | P2       | shared footer components (landing + docs custom homepage) | fixed — footer text-gray-400 → text-gray-600; cyan CTAs/links on pricing, desktop-app, goodbye → cyan-700 |
| L3  | `link-in-text-block` on the goodbye page (link distinguished by color alone)                                                                | 1.4.1 | P3       | `apps/landing/pages/goodbye`                              | fixed — underline no longer hover-only                                                                    |

Docs content pages (Docusaurus theme): **zero violations** — conformance is inherited from the
theme and only the custom homepage/footer needs attention. Note: the docs and landing homepages
share the `url-root` scan key, so the results file holds whichever ran last.

## Manual audit findings

_To be populated during the keyboard / screen reader / visual passes. One row per finding, same columns as the component findings table._
