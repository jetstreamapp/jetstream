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
import { DEFAULT_FEATURE_FLAGS, SalesforceOrgUi, UserProfileUi } from '@jetstream/types';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { fromUnixTime } from 'date-fns';
import { app, safeStorage } from 'electron';
import logger from 'electron-log';
import { chmodSync, existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { jwtDecode } from 'jwt-decode';
import { basename, join } from 'path';
import writeFileAtomic from 'write-file-atomic';

const userData = app.getPath('userData');
const APP_DATA_FILE = join(userData, 'app-data.json');
const USER_PREFERENCES_FILE = join(userData, 'preferences.json');

/**
 * Pre-user-scoping org file, shared by every account that signed in on this machine.
 *
 * Only ever read, never written to. Read on any cold-cache read where the signed-in user has no
 * scoped file yet — so a user who does not own it (or whose migration fails) retries on every
 * subsequent read, not just once. It is retired once the scoped file exists, which stands in for a
 * contents check because the migrating write is atomic: it either lands whole or leaves nothing to
 * find. Retirement renames rather than deletes, so the non-atomic fallback write failing halfway
 * still leaves the data recoverable. See `adoptLegacyOrgsFile` and `retireLegacyOrgsFile`.
 */
const LEGACY_SFDC_ORGS_FILE = join(userData, 'orgs.json');

/** Magic bytes identifying the portable AES-256-GCM encryption format */
const JSEK_MAGIC = Buffer.from('JSEK');

/**
 * Restrictive file mode (owner read/write only) for the credential-bearing files:
 * app-data.json (holds the Jetstream session JWT) and the per-user org files (which hold the
 * AES-GCM-encrypted Salesforce tokens). Defends against other local accounts and loosely-permissioned
 * roaming/VDI profile shares reading these files. POSIX only — Node largely ignores mode bits
 * on Windows, where NTFS ACLs govern access. Applied on every atomic write, so pre-existing
 * world-readable files are tightened on the next write.
 */
const SECURE_FILE_MODE = 0o600;

let APP_DATA: AppData;
let SALESFORCE_ORGS: SalesforceOrgServer[] | undefined;
let JETSTREAM_ORGS: JetstreamOrganizationServer[] | undefined;
let USER_PREFERENCES: DesktopUserPreferences;

/**
 * Org storage bound to the signed-in user: the file their orgs live in, and the portable
 * encryption key derived from their user id. Held in memory only, never persisted to disk.
 */
interface OrgSession {
  path: string;
  key: Buffer;
}

/** Null while logged out, which blocks every org read and write. */
let ORG_SESSION: OrgSession | null = null;

/**
 * Org data lives in a per-user file so that signing in with a second account on a shared
 * machine cannot destroy the first account's orgs. The encryption key is derived from the
 * user id server-side, so a single shared file makes "another user's data" indistinguishable
 * from "corrupt data" — both surface as a decryption failure.
 *
 * The filename is a hash of the user id rather than the id itself: it keeps the account id out
 * of directory listings, and unlike a sanitized id it cannot escape the userData directory or
 * realistically collide with another user's file (which would reintroduce the shared-file bug).
 */
function getOrgsFilePathForUser(userId: string): string {
  const scopeHash = createHash('sha256').update(userId).digest('hex').slice(0, 32);
  return join(userData, `orgs-${scopeHash}.json`);
}

/**
 * Binds org storage to the signed-in user: their scoped file plus the portable encryption key
 * derived from their user id server-side. Must be called after successful authentication before
 * reading/writing org data.
 */
export function bindOrgStorageToUser({ userId, encryptionKey }: { userId: string; encryptionKey: string }): void {
  if (!userId) {
    throw new Error('Cannot bind org storage: a userId is required to resolve the user-scoped org file');
  }
  if (!/^[0-9a-f]{64}$/i.test(encryptionKey)) {
    throw new Error(
      `Cannot bind org storage: the encryption key must be 64 hex characters (32 bytes), got ${encryptionKey.length} characters`,
    );
  }
  // Assigned as a single value so a validation failure can never leave one user's key paired
  // with another user's file.
  ORG_SESSION = { path: getOrgsFilePathForUser(userId), key: Buffer.from(encryptionKey, 'hex') };
  // Invalidate in-memory cache so the next readOrgs() re-decrypts from disk with the new key.
  // Without this, a previously-cached empty result (from before the key was available) would persist.
  SALESFORCE_ORGS = undefined;
  JETSTREAM_ORGS = undefined;
  // The file transport persists info logs to disk, so the raw user id stays out of this message —
  // on a shared machine the log would otherwise accumulate a list of every account that signed in.
  // Support can still identify the file by hashing a candidate user id the same way.
  logger.info(`Org storage bound to user (${basename(ORG_SESSION.path)}) — in-memory org cache invalidated`);
}

export function isOrgStorageBound(): boolean {
  return ORG_SESSION !== null;
}

/**
 * Clears all in-memory org state and unbinds org storage from the user.
 * Must be called on logout to prevent leaking one user's data into the next session,
 * which is especially important in VDI/AVD hot-desk environments.
 */
export function clearOrgState(): void {
  logger.info('Clearing org state (logout)');
  // Unbinding is what stops a post-logout write from landing in the previous user's file —
  // readOrgs and saveOrgs both refuse to touch disk without a session.
  ORG_SESSION = null;
  // Set to undefined (not []) so getSalesforceOrgs/getOrgGroups will re-read from disk
  // on next access, preventing a stale empty array from being written over the on-disk data.
  SALESFORCE_ORGS = undefined;
  JETSTREAM_ORGS = undefined;
}

/**
 * Encrypts org data using AES-256-GCM with the portable key.
 * Format: [4-byte magic 'JSEK'][12-byte IV][16-byte authTag][ciphertext]
 */
function encryptOrgsData(data: string, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([JSEK_MAGIC, iv, authTag, encrypted]);
}

/**
 * Decrypts org data encrypted with the portable AES-256-GCM format.
 */
function decryptOrgsData(data: Buffer, key: Buffer): string {
  const iv = data.subarray(4, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
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
  const session = ORG_SESSION;
  if (session) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', session.key, iv);
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
    const session = ORG_SESSION;
    if (!session) {
      throw new Error('Portable encryption key not available to decrypt token');
    }
    const data = Buffer.from(encoded.slice(PORTABLE_TOKEN_PREFIX.length), 'base64');
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', session.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
  // Legacy safeStorage format
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
}

/**
 * Best-effort permission tightening for the non-atomic fallback writes. chmod can throw on Windows,
 * network shares, or restrictive file systems; the data has already been written successfully at this
 * point, so a chmod failure must not crash the app or be surfaced as a write failure — log and move on.
 */
function chmodBestEffort(path: string): void {
  try {
    chmodSync(path, SECURE_FILE_MODE);
  } catch (error) {
    logger.warn(`Unable to tighten permissions on ${path} (best-effort):`, error);
  }
}

function writeFile(path: string, data: string, encrypt = false) {
  let _data: string | Buffer = data;
  if (encrypt) {
    _data = safeStorage.encryptString(data);
  }
  try {
    writeFileAtomic.sync(path, _data, { mode: SECURE_FILE_MODE });
  } catch (error) {
    logger.error(`Error writing file ${path}:`, error);
    writeFileSync(path, Buffer.isBuffer(_data) ? new Uint8Array(_data) : _data, { mode: SECURE_FILE_MODE });
    // writeFileSync's mode only applies when it creates the file; explicitly chmod so a pre-existing
    // world-readable file is tightened even when the atomic write (which replaces the inode) failed.
    chmodBestEffort(path);
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
    // Try plain JSON first (new format), then safeStorage (legacy) for backward compat.
    // safeStorage uses OS credentials (DPAPI on Windows) which don't persist across
    // VDI/AVD sessions, so new writes always use plain JSON.
    let appData: AppData;
    try {
      // New format: plain JSON
      const text = readFileSync(APP_DATA_FILE, 'utf8');
      const result = AppDataSchema.safeParse(JSON.parse(text));
      appData = result.success ? result.data : AppDataSchema.parse({});
    } catch {
      // Plain JSON read/parse failed — try safeStorage (legacy encrypted format).
      // readFileSync(path, 'utf8') on binary data doesn't throw, but JSON.parse will,
      // so we land here for both missing-file and safeStorage-encrypted-file cases.
      try {
        const text = safeStorage.decryptString(readFileSync(APP_DATA_FILE));
        logger.info('Read app-data from legacy safeStorage format — will migrate to plain JSON on next write');
        const result = AppDataSchema.safeParse(JSON.parse(text));
        appData = result.success ? result.data : AppDataSchema.parse({});
      } catch (safeStorageError) {
        logger.warn('Unable to read app-data (not valid JSON and safeStorage decrypt failed). Starting fresh.', safeStorageError);
        appData = AppDataSchema.parse({});
        writeFile(APP_DATA_FILE, JSON.stringify(appData));
      }
    }
    APP_DATA = appData;
    return appData;
  } catch (ex) {
    logger.error('Error reading app data file', ex);
    const appData = AppDataSchema.parse({});
    writeFile(APP_DATA_FILE, JSON.stringify(appData));
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
  // The server-shaped profile, which is what `AppData` persists - desktop-local preferences are
  // stored separately and merged back in by `getFullUserProfile()`.
  userProfile: UserProfileUi;
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
      analysisTools: true,
      salesforceCanvas: false,
    },
    teamMembership: appData.userProfile.teamMembership,
    subscriptions: [],
    // Server-resolved flags + signature captured from the last /desktop-app/auth/verify response.
    // The renderer verifies the signature before trusting them (fail-closed to code defaults).
    featureFlags: appData.userProfile.featureFlags ?? { ...DEFAULT_FEATURE_FLAGS },
    featureFlagsSignature: appData.userProfile.featureFlagsSignature,
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
    const session = ORG_SESSION;
    // No user to attribute a read to — cold start before auth completes, or after logout. Portable
    // data cannot be decrypted without the key anyway, and the legacy safeStorage file technically
    // could be (it is keyed to the machine, not the user) but reading it here would hand one
    // account's orgs to whoever happened to launch the app, which is the shared-file bug this
    // scoping exists to close. The caller retries once auth lands and binds a user.
    if (!session) {
      logger.info('Orgs requested before org storage is bound to a user — returning empty');
      return { jetstreamOrganizations: [], salesforceOrgs: [] };
    }

    if (!existsSync(session.path)) {
      // First read for this user: adopt the pre-user-scoping orgs.json if it proves to be theirs,
      // otherwise start empty. Nothing is written unless there is something to write, so a failed
      // adoption is retried the next time the cache is cold (auth verify or restart) rather than
      // being sealed off forever by an empty placeholder file.
      const adopted = adoptLegacyOrgsFile(session);
      JETSTREAM_ORGS = adopted?.jetstreamOrganizations ?? [];
      SALESFORCE_ORGS = adopted?.salesforceOrgs ?? [];
      if (adopted) {
        try {
          saveOrgs();
          retireLegacyOrgsFile(session, adopted);
        } catch (ex) {
          // saveOrgs throws so mutations can surface a failed write, but a migration write is not a
          // mutation — the adopted data is already in memory and the legacy file is still the source
          // of truth, so the read succeeds and the next cold read retries. Skipping retirement on the
          // way out is the point: a legacy file that was never copied must not be renamed away.
          logger.error('Failed to persist migrated orgs — leaving the legacy file in place to retry on the next read', ex);
        }
      }
      return { jetstreamOrganizations: JETSTREAM_ORGS, salesforceOrgs: SALESFORCE_ORGS };
    }

    const rawData = readFileSync(session.path);
    let orgsJson: string;
    try {
      orgsJson = decryptOrgsData(rawData, session.key);
    } catch (decryptError) {
      // The file is scoped to this user and only ever written with this user's key, so a failure
      // here means real corruption or a rotated server secret — never another account's data.
      // Rename it to a timestamped backup for postmortem debugging, then start clean.
      logger.warn('Unable to decrypt orgs file (corruption or rotated server secret). Backing up and starting fresh.', decryptError);
      const corruptBackupPath = `${session.path}.corrupt-${Date.now()}`;
      try {
        renameSync(session.path, corruptBackupPath);
        logger.info(`Backed up unreadable orgs file to ${corruptBackupPath}`);
      } catch (renameError) {
        logger.error('Failed to back up unreadable orgs file, attempting delete', renameError);
        try {
          unlinkSync(session.path);
        } catch (unlinkError) {
          logger.error('Failed to delete unreadable orgs file', unlinkError);
        }
      }
      return { jetstreamOrganizations: [], salesforceOrgs: [] };
    }

    const { jetstreamOrganizations, salesforceOrgs } = OrgsPersistenceSchema.parse(JSON.parse(orgsJson));
    JETSTREAM_ORGS = jetstreamOrganizations;
    SALESFORCE_ORGS = salesforceOrgs;
    logger.info(`readOrgs: loaded ${salesforceOrgs.length} orgs and ${jetstreamOrganizations.length} groups from disk`);

    return { jetstreamOrganizations, salesforceOrgs };
  } catch (ex) {
    logger.error('Error reading orgs file', ex);
    return { jetstreamOrganizations: [], salesforceOrgs: [] };
  }
}

/**
 * Reads the pre-user-scoping `orgs.json` and returns its contents if it belongs to the signed-in
 * user, otherwise null.
 *
 * That file was shared by every account that used the machine, so the only way to claim it is to
 * decrypt it. If it does not decrypt with this user's key it belongs to a different account (or
 * predates a server secret rotation) and is left completely untouched — the point of user scoping
 * is that signing in never destroys data that might be someone else's.
 *
 * Nothing is cached or written here; the caller owns persisting the result, so any failure leaves
 * the legacy file exactly as it was and the next read tries again.
 */
function adoptLegacyOrgsFile(session: OrgSession): OrgsPersistence | null {
  if (!existsSync(LEGACY_SFDC_ORGS_FILE)) {
    return null;
  }
  try {
    const rawData = readFileSync(LEGACY_SFDC_ORGS_FILE);
    const isPortable = rawData.subarray(0, 4).equals(JSEK_MAGIC);
    let orgsJson: string;
    try {
      // safeStorage predates per-user keys entirely and is machine- rather than user-scoped, so
      // ownership can't be proven for those files. The first account to sign in claims it, which
      // matches the single-shared-file behavior it was originally written under.
      orgsJson = isPortable ? decryptOrgsData(rawData, session.key) : safeStorage.decryptString(rawData);
    } catch (decryptError) {
      // A portable file that will not decrypt was written with another account's key, so ownership is
      // the only explanation. safeStorage is keyed to the OS credential store instead, so its failures
      // are just as likely to be a profile that moved machines or a VDI session that rotated its DPAPI
      // key. The file is left alone either way — the distinction only matters when reading these logs.
      logger.info(
        isPortable
          ? 'Legacy orgs file did not decrypt for this user — it belongs to a different account, leaving it untouched'
          : 'Legacy safeStorage orgs file did not decrypt — the OS credential store cannot read it (different machine or VDI session, or corruption), leaving it untouched',
        decryptError,
      );
      // Contents are left alone, but a file that will not decrypt is never migrated and never
      // written again, so this is the only chance to tighten whatever (potentially world-readable)
      // mode bits predate SECURE_FILE_MODE. The owning account reads it just the same at 0600.
      chmodBestEffort(LEGACY_SFDC_ORGS_FILE);
      return null;
    }

    const { jetstreamOrganizations, salesforceOrgs } = OrgsPersistenceSchema.parse(JSON.parse(orgsJson));
    return {
      jetstreamOrganizations,
      salesforceOrgs: isPortable ? salesforceOrgs : salesforceOrgs.map(reEncryptLegacyOrgToken),
    };
  } catch (ex) {
    logger.error('Error reading legacy orgs file — leaving it in place to retry on the next read', ex);
    return null;
  }
}

/**
 * Retires the legacy file once its contents are confirmed in the user's scoped file. Kept as a
 * timestamped backup rather than deleted — a silent bug here costs the user every saved org.
 */
function retireLegacyOrgsFile(session: OrgSession, { jetstreamOrganizations, salesforceOrgs }: OrgsPersistence): void {
  try {
    if (!existsSync(session.path)) {
      logger.error('Migration wrote no scoped orgs file — leaving the legacy file in place to retry on the next read');
      // Nothing ever writes this file again, so it keeps whatever (potentially world-readable) mode
      // bits predate SECURE_FILE_MODE unless it is tightened here.
      chmodBestEffort(LEGACY_SFDC_ORGS_FILE);
      return;
    }
    const migratedBackupPath = `${LEGACY_SFDC_ORGS_FILE}.migrated-${Date.now()}`;
    renameSync(LEGACY_SFDC_ORGS_FILE, migratedBackupPath);
    // A rename preserves the legacy file's mode bits, and this backup is never written again, so
    // it would keep whatever (potentially world-readable) permissions predate SECURE_FILE_MODE.
    chmodBestEffort(migratedBackupPath);
    logger.info(
      `Migrated ${salesforceOrgs.length} orgs and ${jetstreamOrganizations.length} groups to ${basename(
        session.path,
      )} — original preserved at ${migratedBackupPath}`,
    );
  } catch (ex) {
    // The scoped file already holds the data, so the stale legacy file is simply ignored from here.
    logger.error('Failed to retire the legacy orgs file after migration — leaving it on disk', ex);
    // Same reason as the migrated backup above: a legacy file that survives retirement is never
    // written again, so this is the only chance to stop it sitting there world-readable. Rename can
    // fail on a directory this user cannot write while chmod on a file they own still succeeds.
    chmodBestEffort(LEGACY_SFDC_ORGS_FILE);
  }
}

/** Re-encrypts a legacy safeStorage org token with the portable key so it survives machine changes. */
function reEncryptLegacyOrgToken(org: SalesforceOrgServer): SalesforceOrgServer {
  try {
    const tokenPlaintext = safeStorage.decryptString(Buffer.from(org.accessToken, 'base64'));
    return { ...org, accessToken: encryptTokenPortable(tokenPlaintext) };
  } catch {
    logger.warn({ uniqueId: org.uniqueId }, 'Failed to migrate token for org — token will need re-auth');
    return org;
  }
}

/** Writes the encrypted org payload to the signed-in user's file, owner-readable only. */
function writeOrgsFile({ path }: OrgSession, encrypted: Buffer) {
  try {
    writeFileAtomic.sync(path, encrypted, { mode: SECURE_FILE_MODE });
  } catch (error) {
    logger.error('Error writing orgs file (atomic):', error);
    writeFileSync(path, new Uint8Array(encrypted), { mode: SECURE_FILE_MODE });
    // writeFileSync's mode is ignored for a pre-existing file, so chmod to guarantee 0600 (see writeFile).
    chmodBestEffort(path);
  }
}

/**
 * Throws when the org data cannot be persisted, whether because storage is not bound to a user or
 * because the write itself failed. Every mutating API routes its write through here and surfaces a
 * thrown error to the renderer, so a caller that gets no error can trust the change reached disk.
 *
 * Both failures are reachable while the app looks perfectly healthy: a cold start whose auth check
 * hits a network error keeps the cached session without ever binding org storage, and a full or
 * read-only disk fails the write. Swallowing either lets a mutation report success on nothing.
 */
function saveOrgs() {
  const session = ORG_SESSION;
  // Without a session there is no key to encrypt with, and the write would land in whichever
  // user's file was last active.
  if (!session) {
    logger.error('saveOrgs: org storage is not bound to a user — refusing the write to prevent data loss');
    throw new Error('Org storage is not bound to a signed-in user — sign in again before changing orgs');
  }
  try {
    const data = { jetstreamOrganizations: JETSTREAM_ORGS ?? [], salesforceOrgs: SALESFORCE_ORGS ?? [] };
    writeOrgsFile(session, encryptOrgsData(JSON.stringify(data), session.key));
    logger.info(`saveOrgs: wrote ${data.salesforceOrgs.length} orgs and ${data.jetstreamOrganizations.length} groups`);
  } catch (ex) {
    logger.error('Error saving orgs file', ex);
    throw ex;
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
