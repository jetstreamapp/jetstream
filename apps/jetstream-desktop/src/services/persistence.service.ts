/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  AppData,
  AppDataSchema,
  DesktopUserPreferences,
  DesktopUserPreferencesSchema,
  JetstreamOrganizationSchema,
  JetstreamOrganizationServer,
  JwtPayload,
  OrgsPersistence,
  OrgsPersistenceSchema,
  SalesforceOrgServer,
  UserProfileUiDesktop,
} from '@jetstream/desktop/types';
import { SalesforceOrgUi } from '@jetstream/types';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'crypto';
import { fromUnixTime } from 'date-fns';
import { app, safeStorage } from 'electron';
import logger from 'electron-log';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { jwtDecode } from 'jwt-decode';
import { join } from 'path';
import writeFileAtomic from 'write-file-atomic';

const userData = app.getPath('userData');
const APP_DATA_FILE = join(userData, 'app-data.json');
const SFDC_ORGS_FILE = join(userData, 'orgs.json');
const USER_PREFERENCES_FILE = join(userData, 'preferences.json');

/** Magic bytes identifying the portable AES-256-GCM encryption format */
const JSEK_MAGIC = Buffer.from('JSEK');

let APP_DATA: AppData;
let SALESFORCE_ORGS: SalesforceOrgServer[];
let JETSTREAM_ORGS: JetstreamOrganizationServer[];
let USER_PREFERENCES: DesktopUserPreferences;

/** Per-user portable encryption key (in memory only, never persisted to disk) */
let ORG_ENCRYPTION_KEY: Buffer | null = null;

/**
 * Set to true once we confirm the on-disk file uses the JSEK portable format.
 * Prevents saveOrgs from downgrading the file back to safeStorage format if the
 * encryption key is temporarily unavailable (e.g. network failure during auth).
 */
let ORG_FILE_IS_PORTABLE = false;

/** Number of decryption retries before giving up and backing up the file.
 * Retries help with VDI roaming profile sync races where the file may be
 * partially written when first read. */
const DECRYPT_RETRY_ATTEMPTS = 3;
const DECRYPT_RETRY_DELAY_MS = 1000;

/** Synchronous sleep for use in retry loops (main process only). */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Renames a corrupt/unreadable file to a timestamped backup for postmortem debugging. */
function backupCorruptFile(filePath: string): void {
  const backupPath = `${filePath}.corrupt-${Date.now()}`;
  try {
    renameSync(filePath, backupPath);
    logger.info(`Backed up unreadable file to ${backupPath}`);
  } catch (renameError) {
    logger.error('Failed to back up unreadable file, attempting delete', renameError);
    try {
      unlinkSync(filePath);
    } catch (unlinkError) {
      logger.error('Failed to delete unreadable file', unlinkError);
    }
  }
}

/**
 * Sets the portable org encryption key derived from the server.
 * Must be called after successful authentication before reading/writing org data.
 */
export function setOrgEncryptionKey(hexKey: string): void {
  if (!/^[0-9a-f]{64}$/i.test(hexKey)) {
    throw new Error(`Invalid org encryption key: expected 64 hex characters (32 bytes), got ${hexKey.length} characters`);
  }
  ORG_ENCRYPTION_KEY = Buffer.from(hexKey, 'hex');
  // Once a portable key is loaded, all future writes must use the portable format.
  ORG_FILE_IS_PORTABLE = true;
  // Invalidate in-memory cache so the next readOrgs() re-decrypts from disk with the new key.
  // Without this, a previously-cached empty result (from before the key was available) would persist.
  SALESFORCE_ORGS = undefined as unknown as SalesforceOrgServer[];
  JETSTREAM_ORGS = undefined as unknown as JetstreamOrganizationServer[];
}

export function isOrgEncryptionKeyLoaded(): boolean {
  return ORG_ENCRYPTION_KEY !== null;
}

/**
 * Clears all in-memory org state and the encryption key.
 * Must be called on logout to prevent leaking one user's data into the next session,
 * which is especially important in VDI/AVD hot-desk environments.
 */
export function clearOrgState(): void {
  ORG_ENCRYPTION_KEY = null;
  // ORG_FILE_IS_PORTABLE intentionally NOT reset — it reflects on-disk state,
  // preventing saveOrgs from downgrading the file to safeStorage after logout.
  // Set to undefined (not []) so getSalesforceOrgs/getOrgGroups will re-read from disk
  // on next access, preventing a stale empty array from being written over the on-disk data.
  SALESFORCE_ORGS = undefined as unknown as SalesforceOrgServer[];
  JETSTREAM_ORGS = undefined as unknown as JetstreamOrganizationServer[];
}

/**
 * Encrypts org data using AES-256-GCM with the portable key.
 * Format: [4-byte magic 'JSEK'][12-byte IV][16-byte authTag][ciphertext]
 */
function encryptOrgsData(data: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ORG_ENCRYPTION_KEY!, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([JSEK_MAGIC, iv, authTag, encrypted]);
}

/**
 * Decrypts org data encrypted with the portable AES-256-GCM format.
 */
function decryptOrgsData(data: Buffer): string {
  const iv = data.subarray(4, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);
  const decipher = createDecipheriv('aes-256-gcm', ORG_ENCRYPTION_KEY!, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/** Prefix identifying a portably-encrypted token string (vs legacy safeStorage base64) */
const PORTABLE_TOKEN_PREFIX = 'jsek:';

/**
 * Encrypts a token string using the portable AES-256-GCM key.
 * Returns a prefixed base64 string: "jsek:<base64(iv + authTag + ciphertext)>"
 * Falls back to safeStorage if the portable key is not available.
 */
export function encryptTokenPortable(plaintext: string): string {
  if (ORG_ENCRYPTION_KEY) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', ORG_ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return PORTABLE_TOKEN_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }
  return safeStorage.encryptString(plaintext).toString('base64');
}

/**
 * Decrypts a token string, auto-detecting portable vs legacy safeStorage format.
 * Tries portable first (prefixed with "jsek:"), then falls back to safeStorage.
 */
export function decryptTokenPortable(encoded: string): string {
  if (encoded.startsWith(PORTABLE_TOKEN_PREFIX)) {
    if (!ORG_ENCRYPTION_KEY) {
      throw new Error('Portable encryption key not available to decrypt token');
    }
    const data = Buffer.from(encoded.slice(PORTABLE_TOKEN_PREFIX.length), 'base64');
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', ORG_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
  // Legacy safeStorage format
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
}

function writeFile(path: string, data: string, encrypt = false) {
  let _data: string | Buffer = data;
  if (encrypt) {
    _data = safeStorage.encryptString(data);
  }
  try {
    writeFileAtomic.sync(path, _data);
  } catch (error) {
    logger.error(`Error writing file ${path}:`, error);
    writeFileSync(path, Buffer.isBuffer(_data) ? new Uint8Array(_data) : _data);
  }
}

function readFile(path: string, decrypt = false) {
  if (decrypt) {
    return safeStorage.decryptString(readFileSync(path));
  }
  return readFileSync(path, 'utf8');
}

/**
 * ******************************
 * APP DATA
 * ******************************
 */

export function getAppData(): AppData {
  try {
    if (APP_DATA) {
      return APP_DATA;
    }
    if (!existsSync(APP_DATA_FILE)) {
      const appData = AppDataSchema.parse({});
      writeFile(APP_DATA_FILE, JSON.stringify(appData));
      APP_DATA = appData;
      return appData;
    }

    // Try plain JSON first (current format), then safeStorage fallback (legacy format).
    // This allows app-data.json to be read on any VM without machine-bound DPAPI keys.
    let appDataRaw: string;
    let needsMigration = false;
    try {
      appDataRaw = readFileSync(APP_DATA_FILE, 'utf8');
      JSON.parse(appDataRaw); // Validate it's parseable JSON
    } catch {
      // Not valid UTF-8 JSON — try safeStorage decryption (legacy format)
      try {
        appDataRaw = safeStorage.decryptString(readFileSync(APP_DATA_FILE));
        needsMigration = true;
        logger.info('Migrating app-data.json from safeStorage to plain JSON');
      } catch {
        logger.warn('Unable to read app-data.json (not valid JSON and safeStorage decryption failed). Starting fresh.');
        const appData = AppDataSchema.parse({});
        writeFile(APP_DATA_FILE, JSON.stringify(appData));
        APP_DATA = appData;
        return appData;
      }
    }

    const maybeAppData = AppDataSchema.safeParse(JSON.parse(appDataRaw));
    const appData = maybeAppData.success ? maybeAppData.data : AppDataSchema.parse({});
    APP_DATA = appData;
    if (needsMigration) {
      // Re-save as plain JSON to complete migration from safeStorage
      writeFile(APP_DATA_FILE, JSON.stringify(appData));
    }
    return appData;
  } catch (ex) {
    logger.error('Error reading app data file', ex);
    const appData = AppDataSchema.parse({});
    writeFile(APP_DATA_FILE, JSON.stringify(appData));
    APP_DATA = appData;
    return appData;
  }
}

export function setAppData(appData: AppData) {
  try {
    appData = AppDataSchema.parse(appData);
    APP_DATA = appData;
    writeFile(APP_DATA_FILE, JSON.stringify(appData));
  } catch (ex) {
    logger.error('Error saving app data file', ex);
    return false;
  }
}

export function saveAuthResponseToAppData({
  deviceId,
  accessToken,
  userProfile,
}: {
  deviceId: string;
  accessToken: string;
  userProfile: UserProfileUiDesktop;
}): AppData {
  const { exp } = jwtDecode<JwtPayload>(accessToken);
  const expiresAt = exp ? fromUnixTime(exp) : new Date();
  const authState: AppData = {
    deviceId,
    accessToken,
    userProfile,
    expiresAt: expiresAt.getTime(),
    lastChecked: Date.now(),
  };

  setAppData({
    deviceId,
    accessToken,
    expiresAt: authState.expiresAt,
    lastChecked: authState.lastChecked,
    userProfile: authState.userProfile,
  });

  return authState;
}

/**
 * ******************************
 * USER PROFILE
 * ******************************
 */

export function getFullUserProfile() {
  const appData = getAppData();
  if (!appData.userProfile) {
    throw new Error('User profile not found');
  }
  const userPreferences = getUserPreferences();

  const userProfile: UserProfileUiDesktop = {
    id: appData.userProfile.id,
    userId: appData.userProfile.id,
    email: appData.userProfile.email,
    name: appData.userProfile.name,
    emailVerified: true,
    picture: appData.userProfile.picture,
    preferences: userPreferences,
    entitlements: {
      googleDrive: false,
      desktop: false,
      chromeExtension: false,
      recordSync: true,
    },
    teamMembership: appData.userProfile.teamMembership,
    subscriptions: [],
  };

  return userProfile;
}

/**
 * ******************************
 * USER PREFERENCES
 * ******************************
 */

function readUserPreferences() {
  try {
    if (USER_PREFERENCES) {
      return USER_PREFERENCES;
    }
    if (!existsSync(USER_PREFERENCES_FILE)) {
      writeFile(USER_PREFERENCES_FILE, JSON.stringify(DesktopUserPreferencesSchema.parse({})));
    }
    const userPreferencesRaw = JSON.parse(readFile(USER_PREFERENCES_FILE));
    const userPreferences = DesktopUserPreferencesSchema.parse(userPreferencesRaw);
    USER_PREFERENCES = userPreferences;
    return userPreferences;
  } catch (ex) {
    logger.error('Error reading preferences file', ex);
    return DesktopUserPreferencesSchema.parse({});
  }
}

export function getUserPreferences() {
  return USER_PREFERENCES || readUserPreferences();
}

export function updateUserPreferences(preferences: Partial<DesktopUserPreferences>) {
  try {
    const updatedPreferences = DesktopUserPreferencesSchema.parse({ ...getUserPreferences(), ...preferences });
    USER_PREFERENCES = updatedPreferences;
    writeFile(USER_PREFERENCES_FILE, JSON.stringify(updatedPreferences));
  } catch (ex) {
    logger.error('Error saving preferences file', ex);
  }
  return getUserPreferences();
}

/**
 * ******************************
 * JETSTREAM AND SALESFORCE ORGS
 * ******************************
 */

function readOrgs(): OrgsPersistence {
  try {
    if (JETSTREAM_ORGS && SALESFORCE_ORGS) {
      return { jetstreamOrganizations: JETSTREAM_ORGS, salesforceOrgs: SALESFORCE_ORGS };
    }
    if (!existsSync(SFDC_ORGS_FILE)) {
      const emptyData = JSON.stringify({ jetstreamOrganizations: [], salesforceOrgs: [] });
      if (ORG_ENCRYPTION_KEY) {
        const encrypted = encryptOrgsData(emptyData);
        writeFileAtomic.sync(SFDC_ORGS_FILE, encrypted);
      } else {
        writeFile(SFDC_ORGS_FILE, emptyData, true);
      }
    }

    const rawData = readFileSync(SFDC_ORGS_FILE);
    logger.debug({ fileSize: rawData.length, magic: rawData.subarray(0, 4).toString('hex') }, 'Reading orgs file');
    // Definite assignment: all failure paths in the decryption branches return early
    let orgsJson!: string;

    if (rawData.subarray(0, 4).equals(JSEK_MAGIC)) {
      // Portable AES-256-GCM format
      if (!ORG_ENCRYPTION_KEY) {
        // Key not yet available (e.g. app started but auth not complete) — return empty and let caller retry after auth
        logger.warn('Org data is in portable format but encryption key is not yet set');
        ORG_FILE_IS_PORTABLE = true;
        return { jetstreamOrganizations: [], salesforceOrgs: [] };
      }
      // Retry decryption to handle VDI roaming profile sync races where the file
      // may be partially written when first read.
      let lastDecryptError: unknown;
      for (let attempt = 1; attempt <= DECRYPT_RETRY_ATTEMPTS; attempt++) {
        try {
          // Re-read file on retries in case the profile sync completed since last attempt
          const fileData = attempt === 1 ? rawData : readFileSync(SFDC_ORGS_FILE);
          orgsJson = decryptOrgsData(fileData);
          ORG_FILE_IS_PORTABLE = true;
          lastDecryptError = null;
          break;
        } catch (err) {
          lastDecryptError = err;
          if (attempt < DECRYPT_RETRY_ATTEMPTS) {
            logger.warn(
              `Portable decryption attempt ${attempt}/${DECRYPT_RETRY_ATTEMPTS} failed, retrying in ${DECRYPT_RETRY_DELAY_MS}ms...`,
            );
            sleepSync(DECRYPT_RETRY_DELAY_MS);
          }
        }
      }
      if (lastDecryptError) {
        logger.warn(
          `Unable to decrypt portable orgs file after ${DECRYPT_RETRY_ATTEMPTS} attempts (wrong key or corruption). Backing up and starting fresh.`,
          lastDecryptError,
        );
        ORG_FILE_IS_PORTABLE = true; // was portable on disk, prevent downgrade to safeStorage
        backupCorruptFile(SFDC_ORGS_FILE);
        return { jetstreamOrganizations: [], salesforceOrgs: [] };
      }
    } else {
      // Legacy safeStorage format — attempt to read and migrate.
      // Retry to handle VDI profile sync races (partially-written file).
      let lastSafeStorageError: unknown;
      for (let attempt = 1; attempt <= DECRYPT_RETRY_ATTEMPTS; attempt++) {
        try {
          const fileData = attempt === 1 ? rawData : readFileSync(SFDC_ORGS_FILE);
          orgsJson = safeStorage.decryptString(fileData);
          lastSafeStorageError = null;
          break;
        } catch (err) {
          lastSafeStorageError = err;
          if (attempt < DECRYPT_RETRY_ATTEMPTS) {
            logger.warn(
              `safeStorage decryption attempt ${attempt}/${DECRYPT_RETRY_ATTEMPTS} failed, retrying in ${DECRYPT_RETRY_DELAY_MS}ms...`,
            );
            sleepSync(DECRYPT_RETRY_DELAY_MS);
          }
        }
      }
      if (lastSafeStorageError) {
        logger.warn(
          `Unable to decrypt orgs file with safeStorage after ${DECRYPT_RETRY_ATTEMPTS} attempts (likely a different machine). Backing up and starting fresh.`,
        );
        backupCorruptFile(SFDC_ORGS_FILE);
        return { jetstreamOrganizations: [], salesforceOrgs: [] };
      }
    }

    const { jetstreamOrganizations, salesforceOrgs } = OrgsPersistenceSchema.parse(JSON.parse(orgsJson));
    JETSTREAM_ORGS = jetstreamOrganizations;
    SALESFORCE_ORGS = salesforceOrgs;

    // Migrate: if we just read a legacy safeStorage file and the portable key is available,
    // re-encrypt per-org tokens portably and re-save the file in the new format.
    if (!rawData.subarray(0, 4).equals(JSEK_MAGIC) && ORG_ENCRYPTION_KEY) {
      logger.info('Migrating orgs file to portable encryption format');
      SALESFORCE_ORGS = SALESFORCE_ORGS.map((org) => {
        try {
          // Decrypt the legacy safeStorage token and re-encrypt with the portable key
          const tokenPlaintext = safeStorage.decryptString(Buffer.from(org.accessToken, 'base64'));
          return { ...org, accessToken: encryptTokenPortable(tokenPlaintext) };
        } catch {
          logger.warn({ uniqueId: org.uniqueId }, 'Failed to migrate token for org — token will need re-auth');
          return org;
        }
      });
      saveOrgs();
    }

    return { jetstreamOrganizations: JETSTREAM_ORGS, salesforceOrgs: SALESFORCE_ORGS };
  } catch (ex) {
    logger.error('Error reading orgs file', ex);
    return { jetstreamOrganizations: [], salesforceOrgs: [] };
  }
}

function saveOrgs() {
  try {
    // Refuse to downgrade a portable-format file to safeStorage if the key is temporarily unavailable.
    // This prevents silent data loss when, e.g., a token refresh triggers saveOrgs before the encryption
    // key has been fetched (network failure on startup).
    if (!ORG_ENCRYPTION_KEY && ORG_FILE_IS_PORTABLE) {
      logger.error('saveOrgs: portable format required but encryption key is unavailable — skipping write to prevent data loss');
      return;
    }
    const data = { jetstreamOrganizations: JETSTREAM_ORGS, salesforceOrgs: SALESFORCE_ORGS };
    if (ORG_ENCRYPTION_KEY) {
      const encrypted = encryptOrgsData(JSON.stringify(data));
      try {
        writeFileAtomic.sync(SFDC_ORGS_FILE, encrypted);
      } catch (error) {
        logger.error('Error writing orgs file (atomic):', error);
        writeFileSync(SFDC_ORGS_FILE, new Uint8Array(encrypted));
      }
      ORG_FILE_IS_PORTABLE = true;
    } else {
      writeFile(SFDC_ORGS_FILE, JSON.stringify(data), true);
    }
  } catch (ex) {
    logger.error('Error saving orgs file', ex);
  }
}

/**
 * ******************************
 * JETSTREAM ORGS
 * ******************************
 */

export function getOrgGroups() {
  return JETSTREAM_ORGS || readOrgs().jetstreamOrganizations;
}

export function createOrgGroup(payload: { name: string; description: string | null }) {
  const newJetstreamOrg: JetstreamOrganizationServer = {
    id: randomUUID(),
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orgs: [],
  };
  const jetstreamOrganization = JetstreamOrganizationSchema.parse(newJetstreamOrg);
  const jetstreamOrganizations = getOrgGroups();
  jetstreamOrganizations.push(jetstreamOrganization);

  JETSTREAM_ORGS = jetstreamOrganizations;
  saveOrgs();
  return newJetstreamOrg;
}

export function updateOrgGroup(id: string, { name, description }: { name: string; description: string | null }) {
  const jetstreamOrganizations = getOrgGroups().map((org) => {
    if (org.id === id) {
      return JetstreamOrganizationSchema.parse({
        ...org,
        name,
        description,
        updatedAt: new Date().toISOString(),
      });
    }
    return org;
  });

  const jetstreamOrganization = jetstreamOrganizations.find((org) => org.id === id);
  if (!jetstreamOrganization) {
    throw new Error(`Jetstream organization with id ${id} not found`);
  }

  JETSTREAM_ORGS = jetstreamOrganizations;
  saveOrgs();
  return jetstreamOrganization;
}

export function deleteOrgGroup(id: string) {
  const jetstreamOrganizations = getOrgGroups().filter((org) => org.id !== id);

  const salesforceOrgs = getSalesforceOrgs().map((org) => {
    if (org.jetstreamOrganizationId === id) {
      org.jetstreamOrganizationId = null;
    }
    return org;
  });

  JETSTREAM_ORGS = jetstreamOrganizations;
  SALESFORCE_ORGS = salesforceOrgs;
  saveOrgs();
  return jetstreamOrganizations;
}

export function deleteOrgGroupAndAllOrgs(id: string) {
  const jetstreamOrganizations = getOrgGroups().filter((org) => org.id !== id);

  const salesforceOrgs = getSalesforceOrgs().filter((org) => {
    return org.jetstreamOrganizationId !== id;
  });

  JETSTREAM_ORGS = jetstreamOrganizations;
  SALESFORCE_ORGS = salesforceOrgs;
  saveOrgs();
  return jetstreamOrganizations;
}

export function moveSalesforceOrgToJetstreamOrg({ orgGroupId, uniqueId }: { uniqueId: string; orgGroupId: string | null }) {
  const jetstreamOrganizations = getOrgGroups().map((org) => {
    if (org.id === orgGroupId) {
      org.orgs.push({ uniqueId });
    } else {
      org.orgs = org.orgs.filter((org) => org.uniqueId !== uniqueId);
    }
    org.orgs = Array.from(new Set(org.orgs));
    return org;
  });

  const salesforceOrgs = getSalesforceOrgs().map((org) => {
    if (org.uniqueId === uniqueId) {
      org.jetstreamOrganizationId = orgGroupId;
    }
    return org;
  });

  JETSTREAM_ORGS = jetstreamOrganizations;
  SALESFORCE_ORGS = salesforceOrgs;
  saveOrgs();
  return { salesforceOrgs, jetstreamOrganizations };
}

/**
 * ******************************
 * SALESFORCE ORGS
 * ******************************
 */

export function getSalesforceOrgs() {
  return SALESFORCE_ORGS || readOrgs().salesforceOrgs;
}

export function removeSalesforceOrg(uniqueId: string) {
  let { jetstreamOrganizations, salesforceOrgs } = readOrgs();
  salesforceOrgs = salesforceOrgs.filter((org) => org.uniqueId !== uniqueId);
  jetstreamOrganizations = jetstreamOrganizations.map((org) => {
    org.orgs = org.orgs.filter((org) => org.uniqueId !== uniqueId);
    return org;
  });
  JETSTREAM_ORGS = jetstreamOrganizations;
  SALESFORCE_ORGS = salesforceOrgs;
  saveOrgs();
  return salesforceOrgs;
}

export function updateSalesforceOrg(uniqueId: string, payload: { label: string; color?: string | null }) {
  const orgs = getSalesforceOrgs().map((org) => {
    if (org.uniqueId === uniqueId) {
      return { ...org, ...payload };
    }
    return org;
  });
  SALESFORCE_ORGS = orgs;
  saveOrgs();
  return orgs;
}

export function updateAccessTokens(uniqueId: string, payload: { accessToken: string; refreshToken: string }) {
  const accessToken = encryptTokenPortable(`${payload.accessToken} ${payload.refreshToken}`);
  const orgs = getSalesforceOrgs().map((org) => {
    if (org.uniqueId === uniqueId) {
      return { ...org, accessToken };
    }
    return org;
  });
  SALESFORCE_ORGS = orgs;
  saveOrgs();
  return orgs;
}

/**
 * Update any property of the org, internal use only
 */
export function updateSalesforceOrg_UNSAFE(uniqueId: string, data: Partial<SalesforceOrgUi>) {
  const orgs = getSalesforceOrgs().map((org) => {
    if (org.uniqueId === uniqueId) {
      return { ...org, ...data };
    }
    return org;
  });
  SALESFORCE_ORGS = orgs;
  saveOrgs();
  return orgs;
}

export function getSalesforceOrgById(uniqueId: string): SalesforceOrgUi | undefined {
  return getSalesforceOrgs().find((org) => org.uniqueId === uniqueId) as SalesforceOrgUi;
}

export function createOrUpdateSalesforceOrg(salesforceOrgUi: Partial<SalesforceOrgUi>) {
  let newOrg: SalesforceOrgServer;
  const existingOrg = getSalesforceOrgById(salesforceOrgUi.uniqueId!);
  if (existingOrg) {
    newOrg = {
      jetstreamOrganizationId: salesforceOrgUi.jetstreamOrganizationId ?? existingOrg.jetstreamOrganizationId,
      uniqueId: salesforceOrgUi.uniqueId ?? existingOrg.uniqueId,
      accessToken: salesforceOrgUi.accessToken ?? existingOrg.accessToken,
      instanceUrl: salesforceOrgUi.instanceUrl ?? existingOrg.instanceUrl,
      loginUrl: salesforceOrgUi.loginUrl ?? existingOrg.loginUrl,
      userId: salesforceOrgUi.userId ?? existingOrg.userId,
      email: salesforceOrgUi.email ?? existingOrg.email,
      label: salesforceOrgUi.label ?? existingOrg.label,
      organizationId: salesforceOrgUi.organizationId ?? existingOrg.organizationId,
      username: salesforceOrgUi.username ?? existingOrg.username,
      displayName: salesforceOrgUi.displayName ?? existingOrg.displayName,
      thumbnail: salesforceOrgUi.thumbnail ?? existingOrg.thumbnail,
      apiVersion: salesforceOrgUi.apiVersion ?? existingOrg.apiVersion,
      orgName: salesforceOrgUi.orgName ?? existingOrg.orgName,
      orgCountry: salesforceOrgUi.orgCountry ?? existingOrg.orgCountry,
      orgOrganizationType: salesforceOrgUi.orgOrganizationType ?? existingOrg.orgOrganizationType,
      orgInstanceName: salesforceOrgUi.orgInstanceName ?? existingOrg.orgInstanceName,
      orgIsSandbox: salesforceOrgUi.orgIsSandbox ?? existingOrg.orgIsSandbox,
      orgLanguageLocaleKey: salesforceOrgUi.orgLanguageLocaleKey ?? existingOrg.orgLanguageLocaleKey,
      orgNamespacePrefix: salesforceOrgUi.orgNamespacePrefix ?? existingOrg.orgNamespacePrefix,
      orgTrialExpirationDate: salesforceOrgUi.orgTrialExpirationDate ?? existingOrg.orgTrialExpirationDate,
      filterText: salesforceOrgUi.filterText ?? `${salesforceOrgUi.username}${salesforceOrgUi.orgName}${salesforceOrgUi.label}`,
      connectionError: null,
    };
  } else {
    newOrg = {
      jetstreamOrganizationId: salesforceOrgUi.jetstreamOrganizationId,
      label: salesforceOrgUi.label || salesforceOrgUi.username!,
      uniqueId: salesforceOrgUi.uniqueId!,
      accessToken: salesforceOrgUi.accessToken!,
      instanceUrl: salesforceOrgUi.instanceUrl!,
      loginUrl: salesforceOrgUi.loginUrl!,
      userId: salesforceOrgUi.userId!,
      email: salesforceOrgUi.email!,
      organizationId: salesforceOrgUi.organizationId!,
      username: salesforceOrgUi.username!,
      displayName: salesforceOrgUi.displayName!,
      thumbnail: salesforceOrgUi.thumbnail,
      apiVersion: salesforceOrgUi.apiVersion,
      orgName: salesforceOrgUi.orgName,
      orgCountry: salesforceOrgUi.orgCountry,
      orgOrganizationType: salesforceOrgUi.orgOrganizationType,
      orgInstanceName: salesforceOrgUi.orgInstanceName,
      orgIsSandbox: salesforceOrgUi.orgIsSandbox,
      orgLanguageLocaleKey: salesforceOrgUi.orgLanguageLocaleKey,
      orgNamespacePrefix: salesforceOrgUi.orgNamespacePrefix,
      orgTrialExpirationDate: salesforceOrgUi.orgTrialExpirationDate,
      connectionError: null,
      filterText: `${salesforceOrgUi.username}${salesforceOrgUi.orgName}${salesforceOrgUi.label}`,
    };
  }
  let orgs = getSalesforceOrgs();
  if (!orgs.find((org) => org.uniqueId === newOrg.uniqueId)) {
    orgs.push(newOrg);
  } else {
    orgs = orgs.map((org) => (org.uniqueId === newOrg.uniqueId ? newOrg : org));
  }
  SALESFORCE_ORGS = orgs;
  moveSalesforceOrgToJetstreamOrg({
    orgGroupId: newOrg.jetstreamOrganizationId ?? null,
    uniqueId: newOrg.uniqueId,
  });
  saveOrgs();
  return newOrg;
}
