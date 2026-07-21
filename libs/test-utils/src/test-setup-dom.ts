/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-useless-constructor */
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

/**
 * jsdom does not expose the `CSS` global (EditorHost uses `CSS.escape` to build cell selectors).
 * Minimal approximation of the spec: backslash-escapes selector-special characters; skips the
 * leading-digit/NUL edge cases, which unit tests don't exercise.
 */
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = {
    escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, '\\$&'),
  } as unknown as typeof CSS;
}

/**
 * jsdom does not implement `window.matchMedia`, so anything that feature-detects the environment
 * through a media query throws on call (`useTitle` checks `display-mode: standalone`, MonacoEditor
 * and the theme code check `prefers-color-scheme`).
 *
 * Always reporting `matches: false` puts tests in the plain-browser, light-scheme case, which is
 * what these call sites treat as their default.
 */
if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof matchMedia;
}
