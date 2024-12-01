/// <reference types="chrome" />
import { logger } from '@jetstream/shared/client-logger';
import { HTTP, INDEXED_DB } from '@jetstream/shared/constants';
import { checkHeartbeat, getJetstreamOrganizations, getOrgs, getUserProfile } from '@jetstream/shared/data';
import { getChromeExtensionVersion, getOrgType, isChromeExtension, parseCookie } from '@jetstream/shared/ui-utils';
import { groupByFlat, orderObjectsBy } from '@jetstream/shared/utils';
import {
  Announcement,
  ApplicationCookie,
  FeatureFlags,
  JetstreamOrganization,
  JetstreamOrganizationWithOrgs,
  Maybe,
  SalesforceOrgUi,
  SalesforceOrgUiType,
  UserProfilePreferences,
  UserProfileSchema,
  UserProfileUi,
} from '@jetstream/types';
import localforage from 'localforage';
import isString from 'lodash/isString';
import { atom, DefaultValue, selector, selectorFamily, useRecoilValue, useSetRecoilState } from 'recoil';

const DEFAULT_PROFILE = UserProfileSchema.parse({
  id: 'unknown',
  userId: 'unknown',
  email: 'unknown',
  name: 'unknown',
  emailVerified: true,
  picture: null,
  preferences: { skipFrontdoorLogin: true },
  featureFlags: { enableSync: true },
});

export const STORAGE_KEYS = {
  SELECTED_ORG_STORAGE_KEY: `SELECTED_ORG`,
  SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY: `SELECTED_JETSTREAM_ORGANIZATION`,
  ANONYMOUS_APEX_STORAGE_KEY: `ANONYMOUS_APEX`,
};

/**
 * Parse application state with a fallback in case there is an issue parsing
 */
function getAppCookie(): ApplicationCookie {
  let appState = parseCookie<ApplicationCookie>(HTTP.COOKIE.JETSTREAM);
  // FIXME: replace with zod schema parsing
  appState = appState
    ? { ...appState }
    : {
        serverUrl: 'http://localhost:3333',
        environment: 'development',
        defaultApiVersion: 'v60.0',
        google_appId: '1071580433137',
        google_apiKey: 'AIzaSyDaqv3SafGq6NmVVwUWqENrf2iEFiDSMoA',
        google_clientId: '1094188928456-fp5d5om6ar9prdl7ak03fjkqm4fgagoj.apps.googleusercontent.com',
      };
  appState.serverUrl = appState.serverUrl || 'https://getjetstream.app';
  appState.environment = appState.environment || 'production';
  appState.defaultApiVersion = appState.defaultApiVersion || 'v60.0';
  appState.google_appId = appState.google_appId || '1071580433137';
  appState.google_apiKey = appState.google_apiKey || 'AIzaSyDaqv3SafGq6NmVVwUWqENrf2iEFiDSMoA';
  appState.google_clientId = appState.google_clientId || '1094188928456-fp5d5om6ar9prdl7ak03fjkqm4fgagoj.apps.googleusercontent.com';

  return appState;
}

function ensureUserProfileInit(pref?: Maybe<UserProfilePreferences>): UserProfilePreferences {
  return {
    // CURRENT
    ...pref,
  };
}

async function getUserPreferences(): Promise<UserProfilePreferences> {
  try {
    const userPreferences = await localforage.getItem<UserProfilePreferences>(INDEXED_DB.KEYS.userPreferences);
    return ensureUserProfileInit(userPreferences);
  } catch (ex) {
    return ensureUserProfileInit();
  }
}

async function getOrgsFromStorage(): Promise<SalesforceOrgUi[]> {
  try {
    const orgs = isChromeExtension() ? [] : await getOrgs();
    return orgs || [];
  } catch (ex) {
    return [];
  }
}

async function fetchJetstreamOrganizations(): Promise<JetstreamOrganization[]> {
  try {
    const orgs = isChromeExtension() ? [] : await getJetstreamOrganizations();
    return orgs || [];
  } catch (ex) {
    return [];
  }
}

async function getSelectedOrgFromStorage(): Promise<string | undefined> {
  try {
    const selectedOrgIdBase64 =
      sessionStorage.getItem(STORAGE_KEYS.SELECTED_ORG_STORAGE_KEY) || localStorage.getItem(STORAGE_KEYS.SELECTED_ORG_STORAGE_KEY);
    if (isString(selectedOrgIdBase64)) {
      return atob(selectedOrgIdBase64);
    }
    return undefined;
  } catch (ex) {
    return undefined;
  }
}

function getSelectedJetstreamOrganizationFromStorage(): Maybe<string> {
  try {
    return (
      sessionStorage.getItem(STORAGE_KEYS.SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY) ||
      localStorage.getItem(STORAGE_KEYS.SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY)
    );
  } catch (ex) {
    return undefined;
  }
}

function setSelectedJetstreamOrganizationFromStorage(id: Maybe<string>) {
  try {
    if (!id) {
      sessionStorage.removeItem(STORAGE_KEYS.SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEYS.SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY, id);
      localStorage.setItem(STORAGE_KEYS.SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY, id);
    }
  } catch (ex) {
    logger.warn('could not save organization to localstorage', ex);
  }
}

async function fetchAppVersion() {
  try {
    return isChromeExtension() ? { version: getChromeExtensionVersion(), announcements: [] } : await checkHeartbeat();
  } catch (ex) {
    return { version: 'unknown' };
  }
}

async function fetchUserProfile(): Promise<UserProfileUi> {
  // FIXME: this is a temporary fix to get the extension working, will want to fetch from server
  const userProfile = isChromeExtension() ? DEFAULT_PROFILE : await getUserProfile();
  // validate flags
  return userProfile;
}

const userPreferenceState = atom<UserProfilePreferences>({
  key: 'userPreferenceState',
  default: getUserPreferences(),
});

export const actionInProgressState = atom<boolean>({
  key: 'actionInProgressState',
  default: false,
});

export const applicationCookieState = atom<ApplicationCookie>({
  key: 'applicationCookieState',
  default: getAppCookie(),
});

export const appVersionState = atom<{ version: string; announcements?: Announcement[] }>({
  key: 'appVersionState',
  default: fetchAppVersion(),
});

export const userProfileState = atom<UserProfileUi>({
  key: 'userState',
  default: fetchUserProfile(),
});

export const featureFlagsSelector = selector<FeatureFlags>({
  key: 'featureFlagsSelector',
  get: ({ get }) => get(userProfileState)?.preferences?.featureFlags,
});

export const hasFeatureFlagAccess = selectorFamily<boolean, keyof FeatureFlags>({
  key: 'hasFeatureFlagAccess',
  get:
    (key) =>
    ({ get }) =>
      !!get(featureFlagsSelector)?.[key],
});

export const jetstreamOrganizationsState = atom<JetstreamOrganization[]>({
  key: 'jetstreamOrganizationsState',
  default: fetchJetstreamOrganizations(),
});

// Combine orgs with organizations
export const jetstreamOrganizationsWithOrgsSelector = selector<JetstreamOrganizationWithOrgs[]>({
  key: 'jetstreamOrganizationsWithOrgsSelector',
  get: ({ get }) => {
    const orgsById = get(salesforceOrgsById);
    return get(jetstreamOrganizationsState).map((organization) => ({
      ...organization,
      orgs: organization.orgs.map(({ uniqueId }) => orgsById[uniqueId]).filter(Boolean),
    }));
  },
  set: ({ set }, newValue) => {
    if (newValue instanceof DefaultValue) {
      return set(jetstreamOrganizationsState, newValue);
    } else {
      return set(
        jetstreamOrganizationsState,
        newValue.map((organization) => ({
          ...organization,
          orgs: organization.orgs.map(({ uniqueId }) => ({ uniqueId })),
        }))
      );
    }
  },
});

export const jetstreamOrganizationsExistsSelector = selector<boolean>({
  key: 'jetstreamOrganizationsExistsSelector',
  get: ({ get }) => get(jetstreamOrganizationsState).length > 0,
});

export const jetstreamActiveOrganizationState = atom<Maybe<string>>({
  key: 'jetstreamActiveOrganizationState',
  default: getSelectedJetstreamOrganizationFromStorage(),
  effects: [({ onSet }) => onSet((newID) => setSelectedJetstreamOrganizationFromStorage(newID))],
});

export const jetstreamActiveOrganizationSelector = selector<Maybe<JetstreamOrganizationWithOrgs>>({
  key: 'jetstreamActiveOrganizationSelector',
  get: ({ get }) => {
    const organizations = get(jetstreamOrganizationsWithOrgsSelector);
    const selectedItemId = get(jetstreamActiveOrganizationState);
    return organizations.find((org) => org.id === selectedItemId);
  },
});

export const salesforceOrgsState = atom<SalesforceOrgUi[]>({
  key: 'salesforceOrgsState',
  default: getOrgsFromStorage(),
});

export const salesforceOrgsForOrganizationSelector = selector({
  key: 'salesforceOrgsForOrganizationSelector',
  get: ({ get }) => {
    const salesforceOrgs = get(salesforceOrgsState);
    const selectedOrganizationId = get(jetstreamActiveOrganizationState) || null;
    return salesforceOrgs.filter((org) => (org.jetstreamOrganizationId || null) === selectedOrganizationId);
  },
});

export const selectedOrgIdState = atom<Maybe<string>>({
  key: 'selectedOrgIdState',
  default: getSelectedOrgFromStorage(),
});

export const salesforceOrgsWithoutOrganizationSelector = selector({
  key: 'salesforceOrgsWithoutOrganizationSelector',
  get: ({ get }) => {
    return orderObjectsBy(
      get(salesforceOrgsState).filter((org) => !org.jetstreamOrganizationId),
      'label'
    );
  },
});

export const selectedOrgStateWithoutPlaceholder = selector({
  key: 'selectedOrgStateWithoutPlaceholder',
  get: ({ get }) => {
    const salesforceOrgs = get(salesforceOrgsState);
    const selectedOrgId = get(selectedOrgIdState);
    if (isString(selectedOrgId) && Array.isArray(salesforceOrgs)) {
      return salesforceOrgs.find((org) => org.uniqueId === selectedOrgId);
    }
    return undefined;
  },
});

/**
 * If no org is selected, this returns a placeholder
 * it is expected that any component with an org required
 * will be wrapped in an <OrgSelectionRequired> component to guard against this
 */
export const selectedOrgState = selector({
  key: 'selectedOrgState',
  get: ({ get }) => {
    const PLACEHOLDER: SalesforceOrgUi = {
      uniqueId: '',
      label: '',
      filterText: '',
      accessToken: '',
      instanceUrl: '',
      loginUrl: '',
      userId: '',
      email: '',
      organizationId: '',
      username: '',
      displayName: '',
    };
    return get(selectedOrgStateWithoutPlaceholder) || PLACEHOLDER;
  },
});

export const salesforceOrgsOmitSelectedState = selector({
  key: 'salesforceOrgsOmitSelectedState',
  get: ({ get }) => {
    const salesforceOrgs = get(salesforceOrgsState);
    const selectedOrgId = get(selectedOrgIdState);
    if (isString(selectedOrgId) && Array.isArray(salesforceOrgs)) {
      return salesforceOrgs.filter((org) => org.uniqueId !== selectedOrgId);
    }
    return salesforceOrgs;
  },
});

export const selectSkipFrontdoorAuth = selector({
  key: 'selectSkipFrontdoorAuth',
  get: ({ get }) => {
    const userProfile = get(userProfileState);
    return userProfile?.preferences?.skipFrontdoorLogin || false;
  },
});

export const salesforceOrgsById = selector({
  key: 'salesforceOrgsById',
  get: ({ get }) => {
    const salesforceOrgs = get(salesforceOrgsState) || [];
    return groupByFlat(salesforceOrgs, 'uniqueId');
  },
});

export const hasConfiguredOrgState = selector({
  key: 'hasConfiguredOrgState',
  get: ({ get }) => {
    const salesforceOrgs = get(salesforceOrgsState);
    return salesforceOrgs?.length > 0 || false;
  },
});

export const selectedOrgType = selector<Maybe<SalesforceOrgUiType>>({
  key: 'selectedOrgType',
  get: ({ get }) => getOrgType(get(selectedOrgStateWithoutPlaceholder)),
});

export const selectUserPreferenceState = selector<UserProfilePreferences>({
  key: 'selectUserPreferenceState',
  get: ({ get }) => {
    const userPreferences = get(userPreferenceState);
    return userPreferences;
  },
});

export const useUserPreferenceState = (): [UserProfilePreferences, (pref: UserProfilePreferences) => void] => {
  const userPreference = useRecoilValue(selectUserPreferenceState);
  const setUserPreferenceState = useSetRecoilState(userPreferenceState);

  async function setUserPreferences(_userPreference: UserProfilePreferences) {
    setUserPreferenceState(_userPreference);
    try {
      localforage.setItem<UserProfilePreferences>(INDEXED_DB.KEYS.userPreferences, _userPreference);
    } catch (ex) {
      // could not save to localstorage
      logger.warn('could not save to localstorage');
    }
  }

  return [userPreference, setUserPreferences];
};
