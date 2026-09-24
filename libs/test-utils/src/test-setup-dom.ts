/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-useless-constructor */
import { vi } from 'vitest';

/**
 * Component specs render real widgets (floating-ui popovers, 96-option comboboxes, virtualized grids)
 * and many finish with an axe scan, which alone costs seconds. CI runs every project's suite
 * concurrently via `nx run-many -t test`, so those renders contend for CPU and routinely blow
 * Vitest's 5s default — as intermittent, unrelated-looking timeouts. Raise the floor once here rather
 * than per test; it is still short enough to catch a genuine hang.
 */
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

/**
 * Vitest setup for jsdom test environments that load `@dnd-kit/dom` (via `@dnd-kit/react`).
 *
 * `@dnd-kit/dom` references `ResizeObserver` at module-evaluation time, which jsdom does not
 * implement, so merely importing it (e.g. through the `@jetstream/ui` barrel which exports the
 * drag-and-drop powered ExpressionContainer) throws `ReferenceError: ResizeObserver is not defined`.
 * The drag-and-drop behavior itself is not exercised in unit tests, so a no-op shim is sufficient.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverShim {
    // Accept (and ignore) the callback so the shim matches the real `ResizeObserver(callback)` signature.
    constructor(_callback?: ResizeObserverCallback) {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverShim as unknown as typeof ResizeObserver;
}
