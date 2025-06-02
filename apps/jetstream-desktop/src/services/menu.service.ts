import { app, Menu, shell } from 'electron';
import { Browser } from '../browser/browser';
import { isMac } from '../utils/utils';

type MenuItem = Parameters<typeof Menu.buildFromTemplate>[0][0];

export function initAppMenu() {
  let template: MenuItem[] = [];

  template = [
    // { role: 'appMenu' }
    ...((isMac()
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
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
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => Browser.create(),
        },
        { type: 'separator' },
        { role: isMac() ? 'close' : 'quit' },
      ],
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac()
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }],
              },
            ]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
      ],
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac() ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }] : [{ role: 'close' }]),
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
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
