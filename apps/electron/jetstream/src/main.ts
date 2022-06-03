process.env['NODE_OPTIONS'] = '--no-force-async-hooks-checks';
import { app } from 'electron';
import AppUpdater from './app/events/update.events';
import App from './app/app';
import ElectronEvents from './app/events/electron.events';
import SquirrelEvents from './app/events/squirrel.events';
import { initMenus } from './app/menu';
import logger from './app/services/logger';
import { initRollbar } from './app/utils';
export default class Main {
  static initialize() {
    if (SquirrelEvents.handleEvents()) {
      // squirrel event handled (except first run event) and app will exit in 1000ms, so don't do anything else
      app.quit();
    }
  }

  static bootstrapApp() {
    App.main(app);
    initMenus(app);
  }

  static bootstrapAppEvents() {
    ElectronEvents.bootstrapElectronEvents();

    // initialize auto updater service
    if (!App.isDevelopmentMode()) {
      app.once('ready', () => {
        new AppUpdater();
      });
    }
  }
}

logger.log('[APP][STARTING]');

// TODO: respect preferences
initRollbar();

// handle setup events as quickly as possible
Main.initialize();

// bootstrap app
Main.bootstrapApp();
Main.bootstrapAppEvents();
