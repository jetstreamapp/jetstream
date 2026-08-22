import { expect, test } from '../../fixtures/fixtures';

const OPEN_EXTERNAL_CALLS_KEY = '__testOpenExternalCalls';

test.describe('External link handling', () => {
  // Exercises browser.ts's setWindowOpenHandler directly (rather than depending on finding a
  // specific in-app link to click) — it's the actual security boundary: any cross-origin
  // window.open() must be denied and routed through openExternalSafe/shell.openExternal instead of
  // opening a new BrowserWindow.
  test('routes cross-origin window.open() through shell.openExternal, not a new window', async ({ electronApp, mainWindow }) => {
    await electronApp.evaluate(({ shell }, key) => {
      const globalScope = globalThis as unknown as Record<string, unknown>;
      globalScope[key] = [] as string[];
      shell.openExternal = ((url: string) => {
        (globalScope[key] as string[]).push(url);
        return Promise.resolve();
      }) as typeof shell.openExternal;
    }, OPEN_EXTERNAL_CALLS_KEY);

    const windowCountBefore = electronApp.windows().length;

    await mainWindow.evaluate(() => {
      window.open('https://example.com/', '_blank');
    });

    await expect
      .poll(() =>
        electronApp.evaluate((_electron, key) => (globalThis as unknown as Record<string, unknown>)[key], OPEN_EXTERNAL_CALLS_KEY),
      )
      .toEqual(['https://example.com/']);

    // The window-open handler denies the popup outright — no second BrowserWindow should appear.
    expect(electronApp.windows().length).toBe(windowCountBefore);
  });
});
