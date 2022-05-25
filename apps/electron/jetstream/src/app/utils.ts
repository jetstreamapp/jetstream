import { join } from 'path';
import Rollbar from 'rollbar';
import { environment } from '../environments/environment';
import * as fs from 'fs-extra';
import { userPreferencesStorage } from './constants';
import { ElectronPreferences } from '@jetstream/types';

const defaultSettings: ElectronPreferences = {
  isInitialized: false,
  analyticsOptIn: true,
  downloadFolder: { prompt: true },
  defaultApiVersion: '53.0',
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
    let output: ElectronPreferences = defaultSettings;
    const filePath = join(path, userPreferencesStorage);
    if (fs.existsSync(filePath)) {
      output = fs.readJsonSync(filePath) || defaultSettings;
    }
    return output;
  } catch (ex) {
    // TODO: rollbar
    console.error('[ERROR] INIT PREFERENCES', ex.message);
  }
}

export function writePreferences(path: string, preferences: ElectronPreferences): ElectronPreferences {
  try {
    preferences = { ...preferences, isInitialized: true };
    const filePath = join(path, userPreferencesStorage);
    fs.writeJsonSync(filePath, preferences);
    return preferences;
  } catch (ex) {
    // TODO: rollbar
    console.error('[ERROR] SAVE PREFERENCES', ex.message);
  }
}
