import { Menu, shell } from 'electron';
import { join } from 'path';
import App from './app';
const isMac = process.platform === 'darwin';

export function initMenus(app: Electron.App) {
  Menu.setApplicationMenu(initTaskbarMenu(app));
  if (process.platform === 'darwin') {
    app.dock.setIcon(join(__dirname, '/assets/images/icon.png'));
    // app.dock.setMenu(initDock(app));
  }
}

// function initDock(app: Electron.App): Electron.Menu {
//   const dockMenu = Menu.buildFromTemplate([
//     {
//       label: 'New Window',
//       click() {
//         console.log('New Window');
//       },
//     },
//     {
//       label: 'New Window with Settings',
//       submenu: [{ label: 'Basic' }, { label: 'Pro' }],
//     },
//     { label: 'New Command...' },
//   ]);
//   return dockMenu;
// }

function initTaskbarMenu(app: Electron.App): Electron.Menu {
  const template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
    // { role: 'appMenu' }
    ...((isMac
      ? [
          {
            label: 'Jetstream',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Preferences',
                accelerator: 'Command+,',
                click: () => {
                  App.openPreferencesWindow();
                },
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
          },
        ]
      : []) as any),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        // {role: 'window'},
        {
          label: 'New Window',
          accelerator: 'CommandOrControl+Shift+N',
          click: () => {
            App.createWindow(true);
          },
        },
        { type: 'separator' },
        ...(!isMac
          ? [
              {
                label: 'Preferences',
                accelerator: 'Control+,',
                click: () => {
                  App.openPreferencesWindow();
                },
              },
            ]
          : []),
        ...((isMac ? [{ role: 'close' }] : [{ role: 'quit' }]) as any),
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
        ...(isMac
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
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }] : [{ role: 'close' }]),
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'View Documentation',
          click: async () => {
            await shell.openExternal('https://docs.getjetstream.app');
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
