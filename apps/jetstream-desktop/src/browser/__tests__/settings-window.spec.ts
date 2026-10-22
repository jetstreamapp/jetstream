import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeWindow {
  destroyed: boolean;
  isDestroyed: () => boolean;
  close: ReturnType<typeof vi.fn>;
  on: (event: string, handler: () => void) => void;
  loadURL: ReturnType<typeof vi.fn>;
  isMinimized: () => boolean;
  restore: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => ({
  windows: [] as FakeWindow[],
  createWindow: vi.fn(),
}));

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => mocks.windows.filter((window) => !window.destroyed) } }));
vi.mock('../../config/environment', () => ({ ENV: { CLIENT_URL: 'app://jetstream/client/index.html' } }));
vi.mock('../browser', () => ({ Browser: { create: mocks.createWindow } }));

function createFakeWindow(): FakeWindow {
  const listeners = new Map<string, () => void>();
  const window: FakeWindow = {
    destroyed: false,
    isDestroyed: () => window.destroyed,
    close: vi.fn(() => {
      window.destroyed = true;
      listeners.get('closed')?.();
    }),
    on: (event, handler) => listeners.set(event, handler),
    loadURL: vi.fn(),
    isMinimized: () => false,
    restore: vi.fn(),
    focus: vi.fn(),
  };
  mocks.windows.push(window);
  return window;
}

/** The module keeps the open Settings window in module scope, so each test gets a fresh import */
async function loadModule() {
  vi.resetModules();
  mocks.windows = [];
  mocks.createWindow.mockImplementation(() => createFakeWindow());
  return import('../settings-window');
}

describe('settings window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses the open Settings window and moves it to the requested section', async () => {
    const { openSettingsWindow } = await loadModule();

    const settingsWindow = openSettingsWindow();
    expect(mocks.createWindow).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ url: 'app://jetstream/client/index.html?window=settings#/settings' }),
    );

    expect(openSettingsWindow('general')).toBe(settingsWindow);
    expect(mocks.createWindow).toHaveBeenCalledTimes(1);
    expect(settingsWindow.loadURL).toHaveBeenCalledWith('app://jetstream/client/index.html?window=settings#/settings#general');
    expect(settingsWindow.focus).toHaveBeenCalled();
  });

  it('closes the Settings window once the last app window is gone', async () => {
    const { openSettingsWindow, closeSettingsWindowIfAlone } = await loadModule();
    const appWindow = createFakeWindow();
    const settingsWindow = openSettingsWindow();

    closeSettingsWindowIfAlone();
    expect(settingsWindow.close).not.toHaveBeenCalled();

    appWindow.destroyed = true;
    closeSettingsWindowIfAlone();
    expect(settingsWindow.close).toHaveBeenCalled();

    // A closed Settings window is replaced by a new one the next time Settings is opened
    expect(openSettingsWindow()).not.toBe(settingsWindow);
  });
});
