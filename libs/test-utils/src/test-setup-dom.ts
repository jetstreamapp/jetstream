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
