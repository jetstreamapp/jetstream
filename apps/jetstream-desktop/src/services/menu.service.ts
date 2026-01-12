/* eslint-disable @typescript-eslint/no-explicit-any */
import { truncateMiddle } from '@jetstream/shared/utils';
import { app, BrowserWindow, Menu, shell } from 'electron';
import logger from 'electron-log';
import path from 'node:path';
import { Browser } from '../browser/browser';
import { checkForUpdates } from '../config/auto-updater';
import { isMac } from '../utils/utils';
import { getUserPreferences } from './persistence.service';

type MenuItem = Parameters<typeof Menu.buildFromTemplate>[0][0];

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
              {
                label: 'Check for Updates',
                click: () => checkForUpdates(false, true),
              },
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
              {
                label: 'Check for Updates',
                click: () => checkForUpdates(false, true),
              },
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
          click: async () => {
            await shell.openExternal('https://docs.getjetstream.app/');
          },
        },
        {
          label: 'Report an issue',
          click: async () => {
            await shell.openExternal('https://github.com/jetstreamapp/jetstream/issues');
          },
        },
        {
          label: 'Email us',
          click: async () => {
            await shell.openExternal('email:support@getjetstream.app');
          },
        },
        { type: 'separator' },
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
