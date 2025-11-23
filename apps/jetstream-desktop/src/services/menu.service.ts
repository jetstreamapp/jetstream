/* eslint-disable @typescript-eslint/no-explicit-any */
import { app, Menu, shell } from 'electron';
import { Browser } from '../browser/browser';
import { checkForUpdates } from '../config/auto-updater';
import { isMac } from '../utils/utils';

type MenuItem = Parameters<typeof Menu.buildFromTemplate>[0][0];

export function initAppMenu() {
  let template: MenuItem[] = [];

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
        ...((isMac() ? [] : [{ type: 'separator' }, { role: 'about' }]) as any[]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
