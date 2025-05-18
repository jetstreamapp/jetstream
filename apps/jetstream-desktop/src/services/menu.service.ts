import { app, Menu, shell } from 'electron';
import { Browser } from '../browser/browser';
import { ENV } from '../config/environment';
import { isMac } from '../utils/utils';

type MenuItem = Parameters<typeof Menu.buildFromTemplate>[0][0];

export function initAppMenu() {
  let template: MenuItem[] = [];

  if (isMac()) {
    template = [
      // { role: 'appMenu' }
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
      },
      // { role: 'fileMenu' }
      {
        label: 'File',
        submenu: [
          {
            label: '&New Window',
            accelerator: 'CmdOrCtrl+N',
            click: () => Browser.create(),
          },
          { type: 'separator' },
          { role: 'close' },
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
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }],
          },
        ],
      },
      // { role: 'viewMenu' }
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          ENV.ENVIRONMENT === 'development' ? { role: 'forceReload' } : {},
          ENV.ENVIRONMENT === 'development' ? { role: 'toggleDevTools' } : {},
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      // { role: 'windowMenu' }
      // Ideallly we show all the open windows in a list to choose from
      // {
      //   label: 'Window',
      //   submenu: [
      //     { role: 'minimize' },
      //     { role: 'zoom' },
      //   ],
      // },
      {
        role: 'help',
        submenu: [
          {
            label: 'Learn More',
            click: async () => {
              await shell.openExternal('https://docs.getjetstream.app/');
            },
          },
        ],
      },
    ];
  } else {
    template = [
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
          { role: 'quit' },
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
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
        ],
      },
      // { role: 'viewMenu' }
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          ENV.ENVIRONMENT === 'development' ? { role: 'forceReload' } : {},
          ENV.ENVIRONMENT === 'development' ? { role: 'toggleDevTools' } : {},
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
        submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
      },
      {
        role: 'help',
        submenu: [
          {
            label: 'Learn More',
            click: async () => {
              await shell.openExternal('https://docs.getjetstream.app/');
            },
          },
        ],
      },
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
