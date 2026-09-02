---
name: a11y-review
description: Accessibility (WCAG 2.1 AA) review of UI changes - keyboard operation, accessible names/roles/states, focus management, announcements, and the repo's a11y gates. Use before finishing any change that adds or modifies interactive UI, when asked to review a branch or PR for accessibility, or when a user reports a keyboard or screen reader problem.
---

# Accessibility review

Jetstream targets WCAG 2.1 AA (program docs in `docs/accessibility/`). This skill is the review
pass that the 2026 audit and code review used; run it on the current diff before calling UI work
done, or on the files the user names.

## Scope

- Default scope is `git diff --name-only main...HEAD` plus uncommitted changes; the user may
  narrow it to files or an area. Only `.tsx` files that render UI (and their specs) matter.
- **Read each file in full**, not just the hunk: the defect is usually in how the changed element
  interacts with the rest of the component (a role on the parent, a handler on the row).
- Check `docs/accessibility/audit-2026/findings.md` ("Still open after the review") before
  reporting so known, deliberately-open items are not re-raised.

## Checklist

Walk every interactive element in scope and answer each question. "Interactive" includes anything
with an `onClick`, `onKeyDown`, `href`, `tabIndex`, or an ARIA widget role.

1. **Name, role, state.** Does it have an accessible name that matches the visible text (icon-only
   buttons need `title` or `aria-label`; the name must include the visible label - WCAG 2.5.3)?
   Is the role native (`<button>`, `<a href>`) or a correct ARIA widget role on a focusable element?
   Are `aria-expanded`, `aria-selected`, `aria-checked`, `aria-pressed`, `aria-current`,
   `aria-invalid`, `aria-describedby` present where the state exists visually? Is anything
   decorative (`Icon` next to text) hidden rather than named?
2. **Keyboard.** Can it be reached with Tab (or with arrow keys inside a composite) and operated
   with Enter/Space? Do lists, grids, trees, tabs, menus, and radio groups use a single tab stop
   with arrow keys, Home/End, and type-ahead where the APG pattern has it? Is there any trap
   (Monaco editors are the deliberate exception, with the documented Ctrl+M escape)?
3. **Focus management.** When a control unmounts on click (Remove -> Keep/Confirm, Save/Undo,
   delete row, close panel), where does focus go? It must land on the replacement control, the
   nearest sensible sibling, or the trigger - never on `body`. Dialogs and popovers must trap and
   return focus (`Modal`, `Popover`, `FloatingFocusManager` do this; custom panels must too).
   Route changes must not steal focus except after a user-initiated navigation.
4. **Announcements.** Are status changes a screen reader must hear (load progress, results count,
   save confirmation, validation summary, "copied") rendered inside a live region? Are errors
   announced assertively and success/progress politely? Does the live region exist before the
   message arrives (a region mounted with text is not announced)?
5. **Disabled and busy.** A control that disables itself while its own action runs must stay
   focusable (`ariaDisabledButtonProps`) so focus is not dropped and the reason is announced;
   native `disabled` is fine for controls gated by other state. Long operations expose
   `aria-busy` or a status message, not just a spinner.
6. **Forms.** Every input has a `<label for>` or `aria-labelledby` that points at an existing id;
   help text and errors are linked with `aria-describedby`; required and invalid states are in
   ARIA, not only in colour; error summaries move focus or are announced.
7. **Layering.** Escape closes only the top-most layer (popover inside a modal, editor inside a
   grid cell). Anything that handles Escape goes through `useEscapeToCloseLayer`.
8. **Visual (what code can show).** Text and focus rings are not removed with `outline: none`;
   information is not carried by colour alone; the layout tolerates 200% zoom / 320px reflow
   (no fixed pixel heights around text).
9. **Tests.** Interactive `libs/ui` components have an `axeScan()` assertion in their spec;
   keyboard behaviour that was hand-rolled has a unit test; new routes have an
   `a11y-baseline.json` entry.

## Shared primitives to reach for

| Need                                                   | Use                                                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Keep a self-disabling button focusable                 | `ariaDisabledButtonProps` (`libs/ui/src/lib/form/button/aria-disabled-button.utils.ts`)       |
| Announce a status string                               | `AssistiveStatus` (polite region), `useAnnouncer` (imperative), `ScopedNotification` (banner) |
| Escape closes this layer only                          | `useEscapeToCloseLayer` / `EscapeLayerPropagationContext`                                     |
| Single-tab-stop list with row-level extras             | `List` (roving tabindex, `focusListEntryRow`), `Tabs`, `Accordion`, `Tree`                    |
| Filter input that hands off to the list with ArrowDown | `SearchInput` + `List` (see `SobjectFieldList`)                                               |
| Combobox / picklist                                    | `Combobox`, `Picklist` (ARIA 1.2 pattern; focus moves to the option)                          |
| Modal / popover / dropdown menu                        | `Modal`, `Popover`, `DropDown` (focus trap, return focus, Escape)                             |
| Data grid keyboard model                               | `data-table/grid/keyboard/useGridKeyboardNavigation.ts`                                       |
| Skip link, focus main on navigation                    | `SkipLink`, `FocusMainContentOnRouteChange`                                                   |
| Unit-level axe assertion                               | `axeScan(container)` from `@jetstream/test-utils`                                             |

Reference implementations to copy from: `libs/ui/src/lib/modal/Modal.tsx`, `popover/Popover.tsx`,
`form/dropdown/DropDown.tsx`, `list/List.tsx`, `tabs/Tabs.tsx`, and the grid under `data-table/grid/`.

## Gates to run

```bash
pnpm lint                         # jsx-a11y rules at `error` (never demote one)
pnpm a11y:lint-ratchet            # no new warn-tier jsx-a11y hits, axeScan() in new libs/ui specs, every route baselined
pnpm nx run ui:test -- <spec>     # unit specs with axeScan()
pnpm e2e:local a11y               # axe sweep of every route + interactive states against a11y-baseline.json
```

When a fix drops a lint hit, run `pnpm a11y:lint-ratchet --update` so the baseline shrinks with it.
Growth of either baseline needs `--allow-growth` and a line in the findings log.

## Report format

One line per finding, most severe first, then the verified-OK list and anything not exercised:

```
[P1|P2|P3] path/to/File.tsx:123 - claim - who hits it and how (keyboard / VoiceOver / zoom) - fix
```

- **P1**: cannot be completed with a keyboard or a screen reader (trap, unnamed control, lost focus,
  unannounced error, inaccessible required step).
- **P2**: works but wrong or confusing (misleading name, missing state, duplicate announcement,
  focus lands somewhere surprising).
- **P3**: polish and consistency.

Only report what the code proves. If a behaviour depends on runtime layout or a screen reader
quirk, say it is untested rather than guessing.

## Landing fixes

Fix P1 and P2 findings in the same change unless the user asks for a report only. On a branch
with atomic commits, land a fix as `git commit --fixup=<sha>` against the commit that introduced
the defect and leave the autosquash to the author; a fix for a pre-existing gap is a normal commit
with a `fix(<scope>):` subject that says what a user could not do before. Add or extend a spec for
every keyboard or focus behaviour you change, and run `pnpm format` and `pnpm organize-imports`
on touched files.
