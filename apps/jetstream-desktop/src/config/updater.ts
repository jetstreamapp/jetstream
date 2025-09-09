import logger from 'electron-log';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';
import { ENV } from './environment';

/**
 * Setup the auto updater
 */
export function setupAutoUpdater() {
  // TODO: allow user preference for auto updates
  const enableAutoUpdate = ENV.ENVIRONMENT === 'production';

  if (enableAutoUpdate) {
    // Configure auto-updates
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.StaticStorage,
        baseUrl: `https://releases.getjetstream.app/jetstream/${process.platform === 'darwin' ? 'macos' : 'windows'}/${process.arch}`,
      },
      updateInterval: '1 hour',
      notifyUser: true,
      logger,
      // // TODO: custom update UX
      // onNotifyUser: (info) => {
      //   // TODO: Implement custom notification UX
      // },
    });
  }
}

// TODO: Allow checking for updates manually
// export async function checkForUpdates() {
//   if (ENV.ENVIRONMENT !== 'production') {
//     return dialog.showMessageBox({
//       type: 'info',
//       title: 'Update Check',
//       message: 'You are running a development version of Jetstream, the auto updater is disabled.',
//     });
//   }
//   // TODO:
// }
