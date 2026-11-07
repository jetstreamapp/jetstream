import { Menu, shell } from 'electron';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppMenu } from '../menu.service';

type MenuItemTemplate = Parameters<typeof Menu.buildFromTemplate>[0][0];

const mocks = vi.hoisted(() => ({
  recentDocuments: [] as string[],
}));

vi.mock('electron', () => ({
  app: {
    name: 'Jetstream',
    getPath: vi.fn(() => '/tmp/downloads'),
    getRecentDocuments: vi.fn(() => mocks.recentDocuments),
    clearRecentDocuments: vi.fn(),
  },
  Menu: { buildFromTemplate: vi.fn((template) => template), setApplicationMenu: vi.fn() },
  shell: { openPath: vi.fn(async () => ''), showItemInFolder: vi.fn() },
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), transports: { file: { getFile: () => ({ path: '' }) } } },
}));

vi.mock('../../browser/browser', () => ({ Browser: {} }));
vi.mock('../../browser/settings-window', () => ({ openSettingsWindow: vi.fn() }));
vi.mock('../../config/auto-updater', () => ({
  checkForUpdates: vi.fn(),
  getUpdatePolicy: vi.fn(() => ({ allowManualCheck: true, source: 'default' })),
}));
vi.mock('../../utils/url.utils', () => ({ openExternalSafe: vi.fn() }));
vi.mock('../persistence.service', () => ({ getUserPreferences: vi.fn(() => ({ fileDownload: { downloadPath: '/tmp/downloads' } })) }));

/** The submenu entries built for each recent file, keyed by the file's path */
function getRecentFileSubmenus(): Map<string, MenuItemTemplate[]> {
  initAppMenu();
  const template = vi.mocked(Menu.setApplicationMenu).mock.lastCall?.[0] as unknown as MenuItemTemplate[];
  const recentFilesMenu = template.find((item) => item.label === 'Recent Files');
  const submenu = recentFilesMenu?.submenu as MenuItemTemplate[];
  const result = new Map<string, MenuItemTemplate[]>();
  mocks.recentDocuments.forEach((filePath, index) => {
    // Each recent file sits after the "Default download path" entry and its separator
    result.set(filePath, submenu[index + 2].submenu as MenuItemTemplate[]);
  });
  return result;
}

/** The click handler of the named action in a recent file's submenu; fails the test when it is missing */
function getAction(submenu: MenuItemTemplate[] | undefined, label: string): { visible?: boolean; click: () => Promise<void> } {
  const item = submenu?.find((menuItem) => menuItem.label === label || (label === 'Show in' && menuItem.label?.startsWith(label)));
  if (!item?.click) {
    throw new Error(`Menu item "${label}" not found`);
  }
  return { visible: item.visible, click: item.click as () => Promise<void> };
}

describe('menu.service recent files', () => {
  const csvPath = resolve('/tmp/downloads/results.csv');
  const scriptPath = resolve('/tmp/downloads/Q3 Export.bat');

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recentDocuments = [csvPath, scriptPath];
  });

  it('offers Open only for file types Jetstream produces and opens them', async () => {
    const submenus = getRecentFileSubmenus();
    const openItem = getAction(submenus.get(csvPath), 'Open');
    expect(openItem.visible).toBe(true);

    await openItem.click();
    expect(shell.openPath).toHaveBeenCalledWith(csvPath);
  });

  it('never launches a recent file whose type is not one Jetstream produces', async () => {
    const submenus = getRecentFileSubmenus();
    const openItem = getAction(submenus.get(scriptPath), 'Open');
    expect(openItem.visible).toBe(false);

    // Even if the item is somehow activated, the click handler refuses on its own
    await openItem.click();
    expect(shell.openPath).not.toHaveBeenCalled();
  });

  it('still allows revealing any recent file in the file manager', async () => {
    const submenus = getRecentFileSubmenus();
    const showItem = getAction(submenus.get(scriptPath), 'Show in');
    await showItem.click();
    expect(shell.showItemInFolder).toHaveBeenCalledWith(scriptPath);
  });
});
