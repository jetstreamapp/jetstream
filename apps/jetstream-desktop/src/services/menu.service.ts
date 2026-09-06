/* eslint-disable @typescript-eslint/no-explicit-any */
import { truncateMiddle } from '@jetstream/shared/utils';
import { app, BrowserWindow, Menu, shell } from 'electron';
import logger from 'electron-log';
import path from 'node:path';
import { Browser } from '../browser/browser';
import { checkForUpdates, getUpdatePolicy } from '../config/auto-updater';
import { openExternalSafe } from '../utils/url.utils';
import { isMac } from '../utils/utils';
import { getUserPreferences } from './persistence.service';

// TEMPORARILY DISABLED - only used by the commented-out crash reporting menu item
// import { IpcEventChannel } from '@jetstream/desktop/types';

type MenuItem = Parameters<typeof Menu.buildFromTemplate>[0][0];

/**
 * When an administrator has disabled updates the app has no update path at all, so a live "Check
 * for Updates" would just fail silently. Replace it with a disabled item that says who is in
 * charge, rather than dropping it and leaving the user wondering where it went.
 */
function checkForUpdatesMenuItem(): MenuItem {
  const { allowManualCheck, source } = getUpdatePolicy();
  if (!allowManualCheck) {
    return {
      label: source === 'portable' ? 'Updates Not Available in Portable Mode' : 'Updates Managed by Your Organization',
      enabled: false,
    };
  }
  return {
    label: 'Check for Updates',
    click: () => checkForUpdates(true),
  };
}

export function initAppMenu() {
  let template: MenuItem[] = [];

  const defaultDownloadPath = getUserPreferences().fileDownload?.downloadPath || app.getPath('downloads');
  const recentDocuments = app.getRecentDocuments().slice(0, 50);

  template = [
    ...((isMac()
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              checkForUpdatesMenuItem(),
              { type: 'separator' },
              {
                label: 'Settings',
                click: (_, window) => (window as BrowserWindow | undefined)?.webContents.send('open-settings'),
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } as MenuItem,
        ]
      : []) as any[]),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => Browser.create(),
        },
        ...((isMac()
          ? []
          : [
              { type: 'separator' },
              {
                label: 'Settings',
                click: (_, window) => (window as BrowserWindow | undefined)?.webContents.send('open-settings'),
              },
              { type: 'separator' },
              checkForUpdatesMenuItem(),
            ]) as any[]),
        { type: 'separator' },
        isMac() ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Recent Files',
      submenu: [
        {
          label: `Default download path`,
          sublabel: defaultDownloadPath,
          visible: !!defaultDownloadPath,
          click: async () => {
            await shell.openPath(defaultDownloadPath);
          },
        },
        { type: 'separator' },
        ...recentDocuments.map((filePath): MenuItem => {
          const fileName = truncateMiddle(path.basename(filePath), 125);
          return {
            label: fileName,
            submenu: [
              {
                label: 'Open',
                click: async () => await shell.openPath(filePath),
              },
              {
                label: isMac() ? 'Show in Finder' : 'Show in Explorer',
                click: async () => await shell.showItemInFolder(filePath),
              },
            ],
          };
        }),
        { type: 'separator', visible: recentDocuments.length > 0 },
        {
          label: 'Clear Recent Files',
          enabled: recentDocuments.length > 0,
          click: () => {
            app.clearRecentDocuments();
            initAppMenu();
          },
        },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            openExternalSafe('https://docs.getjetstream.app/');
          },
        },
        {
          label: 'Report an issue',
          click: () => {
            openExternalSafe('https://github.com/jetstreamapp/jetstream/issues');
          },
        },
        {
          label: 'Email us',
          click: () => {
            openExternalSafe('mailto:support@getjetstream.app');
          },
        },
        { type: 'separator' },
        // TEMPORARILY DISABLED alongside the error tracker itself - there is nothing to opt out of
        // while crash reporting is off, and offering the toggle would imply reports are still sent.
        // {
        //   type: 'checkbox',
        //   label: 'Send crash reports to Jetstream',
        //   checked: getUserPreferences().crashReportingEnabled,
        //   click: (menuItem) => {
        //     const enabled = menuItem.checked;
        //     updateUserPreferences({ crashReportingEnabled: enabled });
        //     // Notify every renderer so their in-app error tracker and preferences state honor the
        //     // change immediately. The main-process tracker reads the preference directly.
        //     BrowserWindow.getAllWindows().forEach(({ webContents }) => webContents.send(IpcEventChannel.crashReportingChanged, enabled));
        //   },
        // },
        {
          label: 'Open Log File',
          click: async () => {
            const logPath = logger.transports.file.getFile().path;
            await shell.openPath(logPath);
          },
        },
        ...((isMac() ? [] : [{ role: 'about' }]) as any[]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
