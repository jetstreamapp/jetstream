# Accessibility Audit Findings — 2026

Status of every known WCAG 2.1 AA finding. Severity definitions:

- **P1 (material)**: blocks or substantially impairs task completion for assistive-technology or keyboard users. These are the "material accessibility defects" in customer agreements.
- **P2**: degrades the experience but a workaround exists.
- **P3**: best-practice / polish; no significant user impact.

Statuses: `open` → `in-progress` → `fixed (PR #)` | `accepted` (documented rationale, revisit annually).

## Component findings (from code survey, 2026-08-26 — each needs manual verification before the VPAT is finalized)

| #   | Finding                                                                                                     | WCAG         | Severity | Where                                                                            | Status |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------ | -------- | -------------------------------------------------------------------------------- | ------ |
| C1  | Combobox never sets `aria-activedescendant`; active option is not announced during arrow-key navigation     | 4.1.2        | P1       | `libs/ui/src/lib/form/combobox/Combobox.tsx`                                     | open   |
| C2  | Tabs have correct roles but no arrow-key roving tabindex                                                    | 2.1.1        | P1       | `libs/ui/src/lib/tabs/Tabs.tsx`                                                  | open   |
| C3  | TimePicker has no ARIA attributes and no keyboard handling                                                  | 2.1.1, 4.1.2 | P1       | `libs/ui/src/lib/form/time-picker/TimePicker.tsx`                                | open   |
| C4  | No skip link in any user-facing app                                                                         | 2.4.1        | P1       | app shells (web, desktop, landing, extension)                                    | open   |
| C5  | Input/Select don't set `aria-invalid`; error association depends on the caller                              | 3.3.1, 4.1.2 | P1       | `libs/ui/src/lib/form/input/Input.tsx`, `form/select/Select.tsx`                 | open   |
| C6  | Toast uses bare `role="status"`; no `aria-atomic`, no dismissal-timing consideration                        | 4.1.3, 2.2.1 | P2       | `libs/ui/src/lib/toast/Toast.tsx`                                                | open   |
| C7  | DatePicker popup/trigger ARIA contract is thin (DateGrid itself has roving focus)                           | 4.1.2        | P2       | `libs/ui/src/lib/form/date/DatePicker.tsx`                                       | open   |
| C8  | Expression builder drag-and-drop (dnd-kit) keyboard alternative unverified                                  | 2.1.1        | P2       | `libs/ui/src/lib/expression-group/`                                              | open   |
| C9  | Monaco editor needs `accessibilitySupport` configuration and a documented Esc-to-escape-tab-trap affordance | 2.1.2        | P2       | `libs/shared/ui-core/src/app/MonacoEditor.tsx`                                   | open   |
| C10 | Virtualized lists/grid: verify aria-rowcount vs rendered rows and off-screen focus targets                  | 4.1.2        | P2       | `libs/ui/src/lib/form/combobox/ComboboxWithItemsVirtual.tsx`, `data-table/grid/` | open   |

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
| X4  | `nested-interactive`                                                            | serious  | 5 scans      | Draggable org cards etc.: `role="button"` element containing focusable children.                                                                                                                                                                                                                                                                                                                                                                            | P2       |
| X5  | `label` / `select-name`                                                         | critical | 4 scans      | A few raw inputs/selects without an associated label (e.g. number input on grid pagination, columns select on Platform Events). **Fixed** — SOQL format inputs associated via ids, record-form columns select and billing plan radios labeled.                                                                                                                                                                                                              | P1       |
| X6  | `definition-list`                                                               | serious  | 3 scans      | `<dl>` with invalid structure (Home/Team dashboard summary lists).                                                                                                                                                                                                                                                                                                                                                                                          | P3       |
| X7  | `aria-command-name`, `aria-progressbar-name`, `link-name`, `link-in-text-block` | serious  | 1 scan each  | One-off unnamed controls (debug-log button, load progressbar, field "view in Salesforce" link, template link styled as plain text). **Mostly fixed** — progressbars, debug-log buttons/cells, formula/platform-event/fields-list icons labeled; `link-in-text-block` (template link styling) and one residual `aria-command-name` cell remain.                                                                                                              | P2       |

Full per-page evidence: `apps/jetstream-e2e/a11y-results/*.json` (regenerate with `pnpm playwright:test:a11y`).

## Manual audit findings

_To be populated during the keyboard / screen reader / visual passes. One row per finding, same columns as the component findings table._
