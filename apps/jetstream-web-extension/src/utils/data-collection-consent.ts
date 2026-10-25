import { logger } from '@jetstream/shared/client-logger';
import browser from 'webextension-polyfill';

/**
 * Firefox 140+ asks for consent to the data an extension sends off the device, using the categories declared in
 * manifest.json under browser_specific_settings.gecko.data_collection_permissions. History Sync uploads query history
 * and load mappings to the Jetstream server, which is the optional "websiteContent" category, so on Firefox it only
 * runs while that consent is granted. Other browsers have no such permission.
 */
const SYNC_DATA_COLLECTION = { data_collection: ['websiteContent'] } as browser.Permissions.Permissions;

function supportsDataCollectionConsent() {
  return browser.runtime.getURL('').startsWith('moz-extension://');
}

/**
 * Must be called directly from a user action (e.g. a toggle's change handler), before any `await`, or Firefox rejects
 * the permission request.
 */
export function requestSyncDataCollectionConsent(): Promise<boolean> {
  if (!supportsDataCollectionConsent()) {
    return Promise.resolve(true);
  }
  return browser.permissions.request(SYNC_DATA_COLLECTION).catch((ex) => {
    logger.warn('[DATA COLLECTION] Unable to request consent', ex);
    return false;
  });
}

async function disableSyncWithoutConsent() {
  if (await browser.permissions.contains(SYNC_DATA_COLLECTION)) {
    return;
  }
  const { options } = (await browser.storage.local.get('options')) as { options?: { recordSyncEnabled?: boolean } };
  if (options?.recordSyncEnabled) {
    logger.log('[DATA COLLECTION] Turning off History Sync because data collection consent is not granted');
    await browser.storage.local.set({ options: { ...options, recordSyncEnabled: false } });
  }
}

/**
 * Turns History Sync off when consent is missing: for users who turned sync on before the extension asked for
 * consent, and for anyone who later revokes it from about:addons.
 */
export function registerSyncDataCollectionGuard() {
  if (!supportsDataCollectionConsent()) {
    return;
  }
  const checkConsent = () => {
    disableSyncWithoutConsent().catch((ex) => {
      logger.warn('[DATA COLLECTION] Unable to check consent', ex);
    });
  };
  checkConsent();
  browser.permissions.onRemoved.addListener(checkConsent);
}
