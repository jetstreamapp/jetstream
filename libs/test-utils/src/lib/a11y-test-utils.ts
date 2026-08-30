import type { AxeResults } from 'axe-core';
import { axe } from 'vitest-axe';

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
 * Usage:
 *   const results = await axeScan(baseElement);
 *   expect(results.violations).toEqual([]);
 */
export async function axeScan(element: Element): Promise<AxeResults> {
  const results = await axe(element);
  const violations = results.violations
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter(({ html }) => !html.includes('data-floating-ui-focus-guard')),
    }))
    .filter(({ nodes }) => nodes.length > 0);
  return { ...results, violations };
}
