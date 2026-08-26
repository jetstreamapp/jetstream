import type { ElectronApplication } from '@playwright/test';

/**
 * Introspection of the launched app's MAIN process, via `electronApp.evaluate()`.
 *
 * Deliberately limited to the Electron API surface (the `electron` module is passed into the
 * evaluated callback by Playwright). Node builtins are NOT reachable here: `require` is a
 * module-scoped binding, not a global, so `require('node:fs')` inside an evaluate callback is not
 * reliably in scope.
 *
 * For filesystem assertions, stat/read the test's own `userDataDir` fixture with plain Node `fs`
 * from the test process instead — it is the same directory the app is running against, and it needs
 * no main-process round trip. See `tests/security/token-at-rest.spec.ts`.
 */
export class ElectronMainProcess {
  constructor(private readonly app: ElectronApplication) {}

  /** Where the running app resolved `app.getPath('userData')` — proves `--user-data-dir` isolation took effect. */
  userDataPath(): Promise<string> {
    return this.app.evaluate(({ app }) => app.getPath('userData'));
  }

  /**
   * False for any launch through the generic `electron` binary (including Playwright's), which is
   * what makes `config/environment.ts` select its localhost dev URLs. The whole harness depends on
   * this being false.
   */
  isPackaged(): Promise<boolean> {
    return this.app.evaluate(({ app }) => app.isPackaged);
  }
}
