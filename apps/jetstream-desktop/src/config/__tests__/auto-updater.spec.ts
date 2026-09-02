import type { UpdatePolicy, UpdateStatus } from '@jetstream/desktop/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const autoUpdater = {
    logger: null as unknown,
    autoDownload: true,
    autoInstallOnAppQuit: true,
    listeners: new Map<string, (payload?: unknown) => void>(),
    on(event: string, handler: (payload?: unknown) => void) {
      autoUpdater.listeners.set(event, handler);
      return autoUpdater;
    },
    checkForUpdates: vi.fn(() => Promise.resolve({ updateInfo: { version: '4.14.0' } })),
    quitAndInstall: vi.fn(),
  };
  return {
    autoUpdater,
    loadUpdatePolicy: vi.fn(),
    getUserPreferences: vi.fn(() => ({ autoUpdateEnabled: true })),
    sentWindow: { webContents: { send: vi.fn() } },
  };
});

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [mocks.sentWindow] } }));
vi.mock('electron-log', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('electron-updater', () => ({ autoUpdater: mocks.autoUpdater }));
vi.mock('../update-policy', () => ({ loadUpdatePolicy: mocks.loadUpdatePolicy }));
vi.mock('../error-tracker', () => ({ captureMainException: vi.fn() }));
vi.mock('../../services/persistence.service', () => ({ getUserPreferences: mocks.getUserPreferences }));

function policy(overrides: Partial<UpdatePolicy> = {}): UpdatePolicy {
  return {
    autoUpdateEnabled: true,
    allowManualCheck: true,
    source: 'default',
    managed: false,
    perMachineInstall: false,
    ...overrides,
  };
}

/**
 * The module keeps the resolved policy and last status in module scope, so every test gets a fresh
 * import rather than trying to unwind that state between cases.
 */
async function loadModule(initialPolicy: UpdatePolicy) {
  vi.resetModules();
  mocks.autoUpdater.listeners.clear();
  mocks.autoUpdater.autoDownload = true;
  mocks.autoUpdater.autoInstallOnAppQuit = true;
  mocks.loadUpdatePolicy.mockResolvedValue(initialPolicy);

  const autoUpdaterModule = await import('../auto-updater');
  await autoUpdaterModule.initializeAutoUpdater();
  return autoUpdaterModule;
}

/** Drive electron-updater's own events the way a real check would. */
function emit(event: string, payload?: unknown) {
  const handler = mocks.autoUpdater.listeners.get(event);
  if (!handler) {
    throw new Error(`No listener registered for "${event}"`);
  }
  handler(payload);
}

describe('auto-updater', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.getUserPreferences.mockReturnValue({ autoUpdateEnabled: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('download gating', () => {
    /**
     * Regression: autoDownload was tied to the policy, so a user who turned off automatic updates
     * and then ran "Check for Updates" got an update stuck on the `available` status - never
     * downloaded, with no button to press. Checks are the gate; downloads follow them.
     */
    it('leaves autoDownload on when the user turns off automatic updates', async () => {
      await loadModule(policy({ autoUpdateEnabled: false, source: 'user-preference' }));
      expect(mocks.autoUpdater.autoDownload).toBe(true);
    });

    it('leaves autoDownload on when an administrator disables updates', async () => {
      await loadModule(policy({ autoUpdateEnabled: false, allowManualCheck: false, source: 'managed-policy', managed: true }));
      expect(mocks.autoUpdater.autoDownload).toBe(true);
    });

    it('runs a user-initiated check after the user opted out of automatic updates', async () => {
      const { checkForUpdates } = await loadModule(policy({ autoUpdateEnabled: false, source: 'user-preference' }));

      checkForUpdates(true);

      expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('ignores an automatic check after the user opted out', async () => {
      const { checkForUpdates } = await loadModule(policy({ autoUpdateEnabled: false, source: 'user-preference' }));

      checkForUpdates();

      expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    });

    it('refuses even a user-initiated check when an administrator disabled updates', async () => {
      const { checkForUpdates, getCurrentUpdateStatus } = await loadModule(
        policy({ autoUpdateEnabled: false, allowManualCheck: false, source: 'managed-policy', managed: true }),
      );

      checkForUpdates(true);

      expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
      expect(getCurrentUpdateStatus()).toEqual({ status: 'disabled', disabledBy: 'managed-policy' });
    });

    it('schedules no background checks while updates are disabled', async () => {
      await loadModule(policy({ autoUpdateEnabled: false, source: 'user-preference' }));

      await vi.advanceTimersByTimeAsync(5 * 60 * 60 * 1000);

      expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    });

    /**
     * The menu is built from the permissive default before the policy's registry/profile reads
     * land, so a managed install would otherwise expose a live "Check for Updates" for as long as
     * those reads take.
     */
    it('refuses a check before the policy has resolved', async () => {
      vi.resetModules();
      mocks.autoUpdater.listeners.clear();
      let resolvePolicy: (value: UpdatePolicy) => void = () => undefined;
      mocks.loadUpdatePolicy.mockReturnValue(new Promise<UpdatePolicy>((resolve) => (resolvePolicy = resolve)));

      const { initializeAutoUpdater, checkForUpdates } = await import('../auto-updater');
      const initPromise = initializeAutoUpdater();

      checkForUpdates(true);
      expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();

      resolvePolicy(policy());
      await initPromise;

      checkForUpdates(true);
      expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('falls back to permissive defaults when the policy lookup throws', async () => {
      vi.resetModules();
      mocks.autoUpdater.listeners.clear();
      mocks.loadUpdatePolicy.mockRejectedValue(new Error('registry exploded'));

      const { initializeAutoUpdater, checkForUpdates } = await import('../auto-updater');
      await initializeAutoUpdater();

      checkForUpdates(true);

      expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('checks shortly after startup when updates are enabled', async () => {
      await loadModule(policy());

      await vi.advanceTimersByTimeAsync(30 * 1000);

      expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    });
  });

  describe('a downloaded update that is already waiting', () => {
    /**
     * Regression: turning the setting off re-sent a `disabled` status that clobbered `ready`, so an
     * update already sitting on disk lost its Install button.
     */
    it('stays installable when the user turns off automatic updates', async () => {
      const { refreshUpdatePolicy, getCurrentUpdateStatus } = await loadModule(policy());
      emit('update-downloaded', { version: '4.14.0' });
      expect(getCurrentUpdateStatus().status).toBe('ready');

      mocks.loadUpdatePolicy.mockResolvedValue(policy({ autoUpdateEnabled: false, source: 'user-preference' }));
      await refreshUpdatePolicy();

      expect(getCurrentUpdateStatus()).toMatchObject({ status: 'ready', version: '4.14.0' });
    });

    it('is withdrawn when an administrator disables updates', async () => {
      const { refreshUpdatePolicy, getCurrentUpdateStatus } = await loadModule(policy());
      emit('update-downloaded', { version: '4.14.0' });

      mocks.loadUpdatePolicy.mockResolvedValue(
        policy({ autoUpdateEnabled: false, allowManualCheck: false, source: 'managed-policy', managed: true }),
      );
      await refreshUpdatePolicy();

      expect(getCurrentUpdateStatus()).toEqual({ status: 'disabled', disabledBy: 'managed-policy' });
    });

    it('reports a plain disabled status when nothing was in flight', async () => {
      const { refreshUpdatePolicy, getCurrentUpdateStatus } = await loadModule(policy());

      mocks.loadUpdatePolicy.mockResolvedValue(policy({ autoUpdateEnabled: false, source: 'user-preference' }));
      await refreshUpdatePolicy();

      expect(getCurrentUpdateStatus()).toEqual({ status: 'disabled', disabledBy: 'user-preference' });
    });
  });

  /**
   * Every preference save goes through refreshUpdatePolicy(), not only the update toggle, so an
   * unchanged policy must be a no-op - otherwise saving the download folder re-arms the timers and
   * overwrites whatever status the user is looking at.
   */
  describe('re-applying an unchanged policy', () => {
    it('does not schedule a second startup check', async () => {
      const { refreshUpdatePolicy } = await loadModule(policy());

      await vi.advanceTimersByTimeAsync(20 * 1000);
      await refreshUpdatePolicy();
      await vi.advanceTimersByTimeAsync(20 * 1000);

      expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

      // Nothing was re-armed, so no second startup check fires later either.
      await vi.advanceTimersByTimeAsync(30 * 1000);
      expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    });

    it('leaves the result of a manual check on screen', async () => {
      const { refreshUpdatePolicy, getCurrentUpdateStatus } = await loadModule(
        policy({ autoUpdateEnabled: false, source: 'user-preference' }),
      );
      emit('update-not-available', { version: '4.13.0' });
      expect(getCurrentUpdateStatus()).toEqual({ status: 'up-to-date' });

      await refreshUpdatePolicy();

      expect(getCurrentUpdateStatus()).toEqual({ status: 'up-to-date' });
    });

    it('still reconciles when the resolved policy actually changed', async () => {
      const { refreshUpdatePolicy, getCurrentUpdateStatus } = await loadModule(policy());

      mocks.loadUpdatePolicy.mockResolvedValue(policy({ autoUpdateEnabled: false, source: 'user-preference' }));
      await refreshUpdatePolicy();

      expect(getCurrentUpdateStatus()).toEqual({ status: 'disabled', disabledBy: 'user-preference' });
    });
  });

  describe('per-machine installs', () => {
    it('never installs silently on quit', async () => {
      await loadModule(policy({ perMachineInstall: true }));
      expect(mocks.autoUpdater.autoInstallOnAppQuit).toBe(false);
    });

    it('installs silently on quit for an ordinary per-user install', async () => {
      await loadModule(policy());
      expect(mocks.autoUpdater.autoInstallOnAppQuit).toBe(true);
    });

    /**
     * The user's toggle gates checks, not installs. An update they fetched through a manual check
     * is promised to land on restart, which only holds if install-on-quit stays armed.
     */
    it('still installs on quit when the user turned off automatic updates', async () => {
      await loadModule(policy({ autoUpdateEnabled: false, source: 'user-preference' }));
      expect(mocks.autoUpdater.autoInstallOnAppQuit).toBe(true);
    });

    it('tells the UI that installing will need an administrator', async () => {
      const { getCurrentUpdateStatus } = await loadModule(policy({ perMachineInstall: true }));

      emit('update-downloaded', { version: '4.14.0' });

      expect(getCurrentUpdateStatus()).toMatchObject({ status: 'ready', requiresElevation: true });
    });

    it('marks a per-user install as not needing elevation', async () => {
      const { getCurrentUpdateStatus } = await loadModule(policy());

      emit('update-downloaded', { version: '4.14.0' });

      expect((getCurrentUpdateStatus() as UpdateStatus).requiresElevation).toBe(false);
    });
  });
});
