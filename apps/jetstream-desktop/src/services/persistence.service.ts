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
import { randomUUID } from 'crypto';
import { fromUnixTime } from 'date-fns';
import { app, safeStorage } from 'electron';
import logger from 'electron-log';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { jwtDecode } from 'jwt-decode';
import { join } from 'path';
import writeFileAtomic from 'write-file-atomic';

const userData = app.getPath('userData');
const APP_DATA_FILE = join(userData, 'app-data.json');
const SFDC_ORGS_FILE = join(userData, 'orgs.json');
const USER_PREFERENCES_FILE = join(userData, 'preferences.json');

let APP_DATA: AppData;
let SALESFORCE_ORGS: SalesforceOrgServer[];
let JETSTREAM_ORGS: JetstreamOrganizationServer[];
let USER_PREFERENCES: DesktopUserPreferences;

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
      writeFile(APP_DATA_FILE, JSON.stringify(appData), true);
    }
    const maybeAppData = AppDataSchema.safeParse(JSON.parse(readFile(APP_DATA_FILE, true)));
    const appData = maybeAppData.success ? maybeAppData.data : AppDataSchema.parse({});
    APP_DATA = appData;
    return appData;
  } catch (ex) {
    logger.error('Error reading app data file', ex);
    const appData = AppDataSchema.parse({});
    writeFile(APP_DATA_FILE, JSON.stringify(appData), true);
    return appData;
  }
}

export function setAppData(appData: AppData) {
  try {
    appData = AppDataSchema.parse(appData);
    APP_DATA = appData;
    writeFile(APP_DATA_FILE, JSON.stringify(appData), true);
  } catch (ex) {
    logger.error('Error reading app data file', ex);
    return false;
  }
}

export function saveAuthResponseToAppData({ deviceId, accessToken }: { deviceId: string; accessToken: string }): AppData {
  const { exp, userProfile } = jwtDecode<JwtPayload>(accessToken);
  const expiresAt = exp ? fromUnixTime(exp) : new Date();
  const authState: AppData = {
    deviceId,
    accessToken: accessToken,
    userProfile: userProfile as any,
    expiresAt: expiresAt.getTime(),
    lastChecked: Date.now(),
  };

  setAppData({
    deviceId,
    accessToken,
    expiresAt: authState.expiresAt,
    lastChecked: authState.lastChecked,
    userProfile: authState.userProfile as any,
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
    email: appData.userProfile.name,
    name: appData.userProfile.email,
    emailVerified: true,
    picture: null,
    preferences: userPreferences,
    entitlements: {
      googleDrive: false,
      chromeExtension: false,
      recordSync: true,
    },
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
      writeFile(SFDC_ORGS_FILE, JSON.stringify({ jetstreamOrganizations: [], salesforceOrgs: [] }), true);
    }
    const orgsRaw = JSON.parse(readFile(SFDC_ORGS_FILE, true));
    const { jetstreamOrganizations, salesforceOrgs } = OrgsPersistenceSchema.parse(orgsRaw);
    JETSTREAM_ORGS = jetstreamOrganizations;
    SALESFORCE_ORGS = salesforceOrgs;
    return { jetstreamOrganizations, salesforceOrgs };
  } catch (ex) {
    logger.error('Error reading orgs file', ex);
    return { jetstreamOrganizations: [], salesforceOrgs: [] };
  }
}

function saveOrgs() {
  try {
    const data = { jetstreamOrganizations: JETSTREAM_ORGS, salesforceOrgs: SALESFORCE_ORGS };
    writeFile(SFDC_ORGS_FILE, JSON.stringify(data), true);
  } catch (ex) {
    logger.error('Error saving orgs file', ex);
  }
}

/**
 * ******************************
 * JETSTREAM ORGS
 * ******************************
 */

export function getJetstreamOrgs() {
  return JETSTREAM_ORGS || readOrgs().jetstreamOrganizations;
}

export function createJetstreamOrg(payload: { name: string; description: string | null }) {
  const newJetstreamOrg: JetstreamOrganizationServer = {
    id: randomUUID(),
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orgs: [],
  };
  const jetstreamOrganization = JetstreamOrganizationSchema.parse(newJetstreamOrg);
  const jetstreamOrganizations = getJetstreamOrgs();
  jetstreamOrganizations.push(jetstreamOrganization);

  JETSTREAM_ORGS = jetstreamOrganizations;
  saveOrgs();
  return newJetstreamOrg;
}

export function updateJetstreamOrg(id: string, { name, description }: { name: string; description: string | null }) {
  const jetstreamOrganizations = getJetstreamOrgs().map((org) => {
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

export function deleteJetstreamOrg(id: string) {
  const jetstreamOrganizations = getJetstreamOrgs().filter((org) => org.id !== id);

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

export function moveSalesforceOrgToJetstreamOrg({
  jetstreamOrganizationId,
  uniqueId,
}: {
  uniqueId: string;
  jetstreamOrganizationId: string | null;
}) {
  const jetstreamOrganizations = getJetstreamOrgs().map((org) => {
    if (org.id === jetstreamOrganizationId) {
      org.orgs.push({ uniqueId });
    } else {
      org.orgs = org.orgs.filter((org) => org.uniqueId !== uniqueId);
    }
    org.orgs = Array.from(new Set(org.orgs));
    return org;
  });

  const salesforceOrgs = getSalesforceOrgs().map((org) => {
    if (org.uniqueId === uniqueId) {
      org.jetstreamOrganizationId = jetstreamOrganizationId;
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
  const accessToken = safeStorage.encryptString(`${payload.accessToken} ${payload.refreshToken}`).toString('base64');
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
    jetstreamOrganizationId: newOrg.jetstreamOrganizationId ?? null,
    uniqueId: newOrg.uniqueId,
  });
  saveOrgs();
  return newOrg;
}
