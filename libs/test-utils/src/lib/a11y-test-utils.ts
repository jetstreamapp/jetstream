import type { AxeResults, NodeResult } from 'axe-core';
import { expect } from 'vitest';
import { axe } from 'vitest-axe';

// Same scope as the Playwright sweep (apps/jetstream-e2e/src/tests/a11y/a11y.utils.ts) and
// scripts/a11y-scan-urls.mjs: WCAG 2.1 A/AA rules only, no axe best-practice rules.
const WCAG_21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const FOCUS_GUARD_ATTRIBUTE = 'data-floating-ui-focus-guard';

/**
 * True only when the flagged node itself is a Floating UI focus guard.
 *
 * axe's `html` is the node's full outerHTML (for elements up to ~300 chars), so a substring test on
 * it would also match a compact wrapper whose descendants include a guard and silently hide real
 * violations on that wrapper (nested-interactive, aria-required-children, list, ...). Resolving the
 * node's target selector back to the live element anchors the check to the node itself.
 */
function isFloatingUiFocusGuard(root: Element, { target }: NodeResult): boolean {
  const [selector] = target;
  if (typeof selector !== 'string') {
    // Shadow DOM paths are arrays of selectors; nothing in the component library renders guards there.
    return false;
  }
  try {
    return root.ownerDocument.querySelector(selector)?.hasAttribute(FOCUS_GUARD_ATTRIBUTE) ?? false;
  } catch {
    // An unresolvable selector keeps the node — the filter must never hide a violation by accident.
    return false;
  }
}

/**
 * Run an axe-core scan for component tests, filtering out Floating UI's focus-guard sentinels.
 *
 * FloatingFocusManager renders visually-hidden `<span role="button" tabindex="0">` focus guards
 * with no accessible name, which trips axe's serious name-related rules (button-name /
 * aria-command-name). The guards exist only to redirect focus at the edges of a floating element
 * (focus never rests on them), so this is accepted library-internal noise, not a user-facing
 * defect. vitest-axe's `axe()` does not expose axe's context exclude, so the guard nodes are
 * filtered out of the results instead.
 *
 * Note: jsdom has no layout engine, so color-contrast checks come back `incomplete` rather than
 * as violations — contrast is covered by the Playwright a11y sweep and manual audit instead.
 *
 * The scan asserts on its own: any remaining violation fails the test, so a bare `await axeScan(el)`
 * is a complete assertion (the lint ratchet counts a spec as covered once it calls `axeScan(`). The
 * filtered results are still returned for specs that want to inspect `incomplete` or `passes`.
 *
 * `knownViolations` names rule ids that are logged as open findings (e.g. `nested-interactive`, X4 in
 * docs/accessibility/audit-2026/findings.md): they are left out of the assertion but stay in the
 * returned `violations`, so a spec can still pin exactly which known rules it expects.
 *
 * Usage:
 *   await axeScan(baseElement);
 *   const results = await axeScan(baseElement, { knownViolations: ['nested-interactive'] });
 */
export async function axeScan(element: Element, { knownViolations = [] }: { knownViolations?: string[] } = {}): Promise<AxeResults> {
  const results = await axe(element, { runOnly: { type: 'tag', values: WCAG_21_AA_TAGS } });
  const violations = results.violations
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter((node) => !isFloatingUiFocusGuard(element, node)),
    }))
    .filter(({ nodes }) => nodes.length > 0);
  const unexpectedViolations = violations.filter(({ id }) => !knownViolations.includes(id));
  expect(unexpectedViolations, 'axe found WCAG 2.1 AA violations').toEqual([]);
  return { ...results, violations };
}
