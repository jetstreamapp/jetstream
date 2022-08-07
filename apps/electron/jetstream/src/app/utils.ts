import { ElectronPreferences } from '@jetstream/types';
import * as fs from 'fs-extra';
import { join } from 'path';
import Rollbar from 'rollbar';
import { environment } from '../environments/environment';
import { userPreferencesStorage } from './constants';
import logger from './services/logger';

const defaultSettings: ElectronPreferences = {
  isInitialized: false,
  analyticsOptIn: true,
  crashReportingOptIn: true,
  downloadFolder: { prompt: true },
  defaultApiVersion: { override: false, overrideValue: environment.sfdcFallbackApiVersion },
};

export let rollbar: Rollbar;

export function initRollbar() {
  rollbar = Rollbar.init({
    accessToken: environment.rollbarClientAccessToken,
    environment: environment.production ? 'development' : 'production',
    captureUncaught: true,
    captureUnhandledRejections: true,
    payload: {
      platform: 'client',
      code_version: environment.version,
    },
  });
}

export function readPreferences(path: string): ElectronPreferences {
  try {
    logger.log('[PREF][READ]');
    let output: ElectronPreferences = defaultSettings;
    const filePath = join(path, userPreferencesStorage);
    if (fs.existsSync(filePath)) {
      output = fs.readJsonSync(filePath) || defaultSettings;
    }
    return output;
  } catch (ex) {
    // TODO: rollbar
    logger.error('[ERROR] INIT PREFERENCES', ex.message);
  }
}

export function writePreferences(path: string, preferences: ElectronPreferences): ElectronPreferences {
  try {
    logger.log('[PREF][WRITE]');
    preferences = { ...preferences, isInitialized: true };
    const filePath = join(path, userPreferencesStorage);
    fs.writeJsonSync(filePath, preferences);
    return preferences;
  } catch (ex) {
    // TODO: rollbar
    logger.error('[ERROR] SAVE PREFERENCES', ex.message);
  }
}
