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
import { groupByFlat } from '@jetstream/shared/utils';
import { Maybe, OrgsWithGroupResponse, SalesforceOrgUi } from '@jetstream/types';
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
let SALESFORCE_ORGS_TO_IGNORE_SYNC_FROM_WEB: string[] = [];
let USER_PREFERENCES: DesktopUserPreferences;

export const WEB_ORG_SYNC_CONNECTION_ERR_MESSAGE = 'This org was synced from the Jetstream web application and must be reconnected';

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
      return {
        jetstreamOrganizations: JETSTREAM_ORGS,
        salesforceOrgs: SALESFORCE_ORGS,
        salesforceOrgsToIgnoreSyncFromWeb: SALESFORCE_ORGS_TO_IGNORE_SYNC_FROM_WEB ?? [],
      };
    }
    if (!existsSync(SFDC_ORGS_FILE)) {
      writeFile(
        SFDC_ORGS_FILE,
        JSON.stringify({ jetstreamOrganizations: [], salesforceOrgs: [], salesforceOrgsToIgnoreSyncFromWeb: [] } satisfies OrgsPersistence),
        true,
      );
    }
    const orgsRaw = JSON.parse(readFile(SFDC_ORGS_FILE, true));
    const { jetstreamOrganizations, salesforceOrgs, salesforceOrgsToIgnoreSyncFromWeb } = OrgsPersistenceSchema.parse(orgsRaw);
    JETSTREAM_ORGS = jetstreamOrganizations;
    SALESFORCE_ORGS = salesforceOrgs;
    SALESFORCE_ORGS_TO_IGNORE_SYNC_FROM_WEB = salesforceOrgsToIgnoreSyncFromWeb;
    return { jetstreamOrganizations, salesforceOrgs, salesforceOrgsToIgnoreSyncFromWeb };
  } catch (ex) {
    logger.error('Error reading orgs file', ex);
    return { jetstreamOrganizations: [], salesforceOrgs: [], salesforceOrgsToIgnoreSyncFromWeb: [] };
  }
}

function saveOrgs() {
  try {
    const data = {
      jetstreamOrganizations: JETSTREAM_ORGS,
      salesforceOrgs: SALESFORCE_ORGS,
      salesforceOrgsToIgnoreSyncFromWeb: SALESFORCE_ORGS_TO_IGNORE_SYNC_FROM_WEB,
    };
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

export function getOrgGroups() {
  return JETSTREAM_ORGS || readOrgs().jetstreamOrganizations;
}

export function createOrgGroup(payload: { id?: string; name: string; description: string | null }) {
  const jetstreamOrganizations = getOrgGroups();

  // If an id is provided, check for an existing group with that id to prevent duplicates
  if (payload.id) {
    const existing = jetstreamOrganizations.find((org) => org.id === payload.id);
    if (existing) {
      return existing;
    }
  }

  const newJetstreamOrg: JetstreamOrganizationServer = {
    id: payload.id || randomUUID(),
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orgs: [],
  };
  const jetstreamOrganization = JetstreamOrganizationSchema.parse(newJetstreamOrg);
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

  const allOrgs = getSalesforceOrgs();
  const deletedWebOrgIds = allOrgs.filter((org) => org.jetstreamOrganizationId === id && org.source === 'WEB').map((org) => org.uniqueId);

  const salesforceOrgs = allOrgs.filter((org) => {
    return org.jetstreamOrganizationId !== id;
  });

  JETSTREAM_ORGS = jetstreamOrganizations;
  SALESFORCE_ORGS = salesforceOrgs;

  if (deletedWebOrgIds.length > 0) {
    SALESFORCE_ORGS_TO_IGNORE_SYNC_FROM_WEB.push(...deletedWebOrgIds);
    SALESFORCE_ORGS_TO_IGNORE_SYNC_FROM_WEB = Array.from(new Set(SALESFORCE_ORGS_TO_IGNORE_SYNC_FROM_WEB));
  }

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
    const seen = new Set<string>();
    org.orgs = org.orgs.filter(({ uniqueId: uid }) => {
      if (seen.has(uid)) {
        return false;
      }
      seen.add(uid);
      return true;
    });
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
  const excludeFromSync = salesforceOrgs.some((org) => org.uniqueId === uniqueId && org.source === 'WEB');
  salesforceOrgs = salesforceOrgs.filter((org) => org.uniqueId !== uniqueId);
  jetstreamOrganizations = jetstreamOrganizations.map((org) => {
    org.orgs = org.orgs.filter((org) => org.uniqueId !== uniqueId);
    return org;
  });
  JETSTREAM_ORGS = jetstreamOrganizations;
  SALESFORCE_ORGS = salesforceOrgs;

  // If org from web, ensure we ignore on future sync attempts to prevent it from coming back
  if (excludeFromSync) {
    SALESFORCE_ORGS_TO_IGNORE_SYNC_FROM_WEB.push(uniqueId);
    SALESFORCE_ORGS_TO_IGNORE_SYNC_FROM_WEB = Array.from(new Set(SALESFORCE_ORGS_TO_IGNORE_SYNC_FROM_WEB));
  }

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

export function mergeWebAppOrgsWithDesktopOrgs(webAppOrgs: Maybe<OrgsWithGroupResponse>) {
  if (!webAppOrgs) {
    return getSalesforceOrgs();
  }
  try {
    const { jetstreamOrganizations, salesforceOrgs, salesforceOrgsToIgnoreSyncFromWeb } = readOrgs();

    const orgGroupMap = new Map();
    const orgGroupsToCreate = new Map();

    const webAppOrgsById = new Map(Object.entries(groupByFlat(webAppOrgs.orgs, 'uniqueId')));
    const webAppGroupsByName = new Map(Object.entries(groupByFlat(webAppOrgs.organizations, 'name')));
    const webAppGroupsById = new Map(Object.entries(groupByFlat(webAppOrgs.organizations, 'id')));

    // Ignore any orgs that were previously deleted from desktop
    salesforceOrgsToIgnoreSyncFromWeb.forEach((uniqueId) => {
      webAppOrgsById.delete(uniqueId);
    });

    // Ignore any orgs that already exist on desktop
    salesforceOrgs.forEach((org) => {
      if (webAppOrgsById.has(org.uniqueId)) {
        webAppOrgsById.delete(org.uniqueId);
      }
    });

    // Figure out which groups already exist - matched by id or name and set mapping of server id to desktop id
    jetstreamOrganizations.forEach((group) => {
      const matchingGroup = webAppGroupsById.get(group.id) || webAppGroupsByName.get(group.name);
      if (matchingGroup) {
        orgGroupMap.set(matchingGroup.id, group.id);
      }
    });

    // Figure out all the groups we need to create
    webAppOrgsById.forEach((webAppOrg) => {
      // if no group or group exists on desktop, ignore
      if (!webAppOrg.jetstreamOrganizationId || orgGroupMap.has(webAppOrg.jetstreamOrganizationId)) {
        return;
      }
      const group = webAppGroupsById.get(webAppOrg.jetstreamOrganizationId);
      if (!group) {
        return;
      }
      orgGroupsToCreate.set(webAppOrg.jetstreamOrganizationId, group);
    });

    // Create any new groups and update mapping with new ids
    orgGroupsToCreate.forEach((group, groupId) => {
      const createdGroup = createOrgGroup({
        id: group.id, // retain same id to make future sync easier
        name: group.name,
        description: group.description,
      });
      orgGroupsToCreate.set(groupId, createdGroup);
      orgGroupMap.set(groupId, createdGroup.id);
    });

    webAppOrgsById.forEach((webAppOrg) => {
      // this sets it on the group automatically
      createOrUpdateSalesforceOrg(
        {
          ...webAppOrg,
          accessToken: 'invalid',
          source: 'WEB',
        },
        { connectionError: WEB_ORG_SYNC_CONNECTION_ERR_MESSAGE },
      );
    });
  } catch (ex) {
    logger.error('Error merging web app orgs with desktop orgs', ex);
  }
  return getSalesforceOrgs();
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

export function createOrUpdateSalesforceOrg(
  salesforceOrgUi: Partial<SalesforceOrgUi>,
  { connectionError }: { connectionError?: string } = {},
) {
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
      filterText: salesforceOrgUi.filterText ?? existingOrg.filterText,
      source: salesforceOrgUi.source ?? existingOrg.source ?? 'DESKTOP',
      // Clear error unless explicitly passed in
      connectionError: connectionError ?? null,
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
      filterText:
        salesforceOrgUi.filterText || `${salesforceOrgUi.username || ''}${salesforceOrgUi.orgName || ''}${salesforceOrgUi.label || ''}`,
      source: salesforceOrgUi.source ?? 'DESKTOP',
      // Clear error unless explicitly passed in
      connectionError: connectionError ?? null,
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
