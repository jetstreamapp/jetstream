import { getUserAbility } from '@jetstream/acl';
import { logger } from '@jetstream/shared/client-logger';
import { HTTP, INDEXED_DB } from '@jetstream/shared/constants';
import { checkHeartbeat, getJetstreamOrganizations, getOrgs, getUserProfile } from '@jetstream/shared/data';
import {
  getBrowserExtensionVersion,
  getOrgType,
  isBrowserExtension,
  isDesktop,
  parseJsonCookie,
  setItemInLocalStorage,
  setItemInSessionStorage,
} from '@jetstream/shared/ui-utils';
import { getDefaultAppState, groupByFlat, orderObjectsBy } from '@jetstream/shared/utils';
import {
  AppInfo,
  TeamBillingStatusSchema,
  type Announcement,
  type ApplicationState,
  type JetstreamOrganization,
  type JetstreamOrganizationWithOrgs,
  type Maybe,
  type SalesforceOrgUi,
  type SalesforceOrgUiType,
  type UserProfilePreferences,
  type UserProfileUi,
} from '@jetstream/types';
import { atom, useAtom, useSetAtom } from 'jotai';
import { unwrap } from 'jotai/utils';
import localforage from 'localforage';
import isString from 'lodash/isString';

// FIXME: browser extension should be able to obtain all of this information after logging in
export const DEFAULT_PROFILE: UserProfileUi = {
  id: 'unknown',
  userId: 'unknown',
  email: 'unknown',
  name: 'unknown',
  emailVerified: true,
  picture: null,
  preferences: {
    skipFrontdoorLogin: true,
    recordSyncEnabled: true,
  },
  // FIXME: we want these true for the browser extension
  entitlements: {
    googleDrive: false,
    chromeExtension: false,
    desktop: false,
    recordSync: false,
  },
  subscriptions: [],
} as UserProfileUi;

export const STORAGE_KEYS = {
  SELECTED_ORG_STORAGE_KEY: `SELECTED_ORG`,
  SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY: `SELECTED_JETSTREAM_ORGANIZATION`,
  ANONYMOUS_APEX_STORAGE_KEY: `ANONYMOUS_APEX`,
  PLATFORM_EVENT_SORT_COLUMNS: `PLATFORM_EVENT_SORT_COLUMNS`,
};

/**
 * Parse application state with a fallback in case there is an issue parsing
 */
function getAppInfo(): ApplicationState {
  let appState = parseJsonCookie<ApplicationState>(HTTP.COOKIE.JETSTREAM);
  return getDefaultAppState(appState);
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
    const orgs = isBrowserExtension() ? [] : await getOrgs();
    return orgs || [];
  } catch (ex) {
    return [];
  }
}

async function fetchJetstreamOrganizations(): Promise<JetstreamOrganization[]> {
  try {
    const orgs = isBrowserExtension() ? [] : await getJetstreamOrganizations();
    return orgs || [];
  } catch (ex) {
    return [];
  }
}

function getSelectedOrgFromStorage(): string | undefined {
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
      setItemInSessionStorage(STORAGE_KEYS.SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY, id);
      setItemInLocalStorage(STORAGE_KEYS.SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY, id);
    }
  } catch (ex) {
    logger.warn('could not save organization to localstorage', ex);
  }
}

const DEFAULT_APP_INFO: AppInfo = { appInfo: getAppInfo(), version: 'unknown', announcements: [] as Announcement[] };

async function fetchAppInfo(): Promise<AppInfo> {
  try {
    return isBrowserExtension()
      ? { appInfo: getAppInfo(), version: getBrowserExtensionVersion(), announcements: [] }
      : await checkHeartbeat();
  } catch (ex) {
    return DEFAULT_APP_INFO;
  }
}

async function fetchUserProfile(): Promise<UserProfileUi> {
  if (isBrowserExtension()) {
    return DEFAULT_PROFILE;
  }
  if (isDesktop()) {
    return await getUserProfile().catch(() => DEFAULT_PROFILE);
  }
  return await getUserProfile();
}

const userPreferenceState = atom<Promise<UserProfilePreferences>>(getUserPreferences());

export const actionInProgressState = atom<boolean>(false);

export const appInfoState = atom<Promise<AppInfo> | AppInfo>(fetchAppInfo());
export const appInfoSyncState = unwrap(appInfoState, (prev) => prev ?? DEFAULT_APP_INFO);

export const applicationCookieState = atom((get) => get(appInfoSyncState).appInfo);
export const appVersionState = atom((get) => get(appInfoSyncState).version);
export const AnnouncementState = atom((get) => get(appInfoSyncState).announcements);

export const isBrowserExtensionState = atom<boolean>(isBrowserExtension());

export const userProfileState = atom<Promise<UserProfileUi> | UserProfileUi>(fetchUserProfile());

/**
 * This is for internal use for derived state to avoid async issues.
 * Use `userProfileState` for components.
 */
export const userProfileSyncState = unwrap(userProfileState, (prev) => prev ?? DEFAULT_PROFILE);

export const isReadOnlyUserState = atom((get) => {
  const userProfile = get(userProfileSyncState);
  return userProfile.teamMembership?.role === 'BILLING';
});

export const abilityState = atom((get) => {
  const userProfile = get(userProfileSyncState);
  return getUserAbility({
    isBrowserExtension: isBrowserExtension(),
    isDesktop: isDesktop(),
    user: userProfile,
  });
});

export const hasPaidPlanState = atom((get) => {
  const userProfile = get(userProfileSyncState);
  if (userProfile.subscriptions.length) {
    return !!userProfile.subscriptions.find((sub) => sub.status === 'ACTIVE' || sub.status === 'TRIALING');
  }
  return !!userProfile.teamMembership?.team && userProfile.teamMembership?.team?.billingStatus !== TeamBillingStatusSchema.enum.PAST_DUE;
});

export const googleDriveAccessState = atom((get) => {
  const isChromeExtension = get(isBrowserExtensionState);
  const ability = get(abilityState);
  return {
    hasGoogleDriveAccess: !isChromeExtension && !isDesktop() && ability.can('access', 'GoogleDrive'),
    googleShowUpgradeToPro: !isChromeExtension && !isDesktop() && ability.cannot('access', 'GoogleDrive'),
  };
});

export const jetstreamOrganizationsAsyncState = atom<Promise<JetstreamOrganization[]> | JetstreamOrganization[]>(
  fetchJetstreamOrganizations(),
);
// Unwrapped value to simplify derived state
export const jetstreamOrganizationsState = unwrap(jetstreamOrganizationsAsyncState, (prev) => prev ?? []);

// Combine orgs with organizations
export const jetstreamOrganizationsWithOrgsSelector = atom(
  (get) => {
    const orgsById = get(salesforceOrgsById);
    const organizations = get(jetstreamOrganizationsState);
    return organizations.map((organization) => ({
      ...organization,
      orgs: organization.orgs.map(({ uniqueId }) => orgsById[uniqueId]).filter(Boolean),
    }));
  },
  (get, set, newValue: JetstreamOrganizationWithOrgs[]) => {
    set(
      jetstreamOrganizationsState,
      newValue.map((organization) => ({
        ...organization,
        orgs: organization.orgs.map(({ uniqueId }) => ({ uniqueId })),
      })),
    );
  },
);

export const jetstreamOrganizationsExistsSelector = atom((get) => {
  const organizations = get(jetstreamOrganizationsState);
  return organizations.length > 0;
});

const _baseJetstreamActiveOrganizationState = atom<Maybe<string>>(getSelectedJetstreamOrganizationFromStorage());

export const jetstreamActiveOrganizationState = atom(
  (get) => get(_baseJetstreamActiveOrganizationState),
  (get, set, newValue: Maybe<string>) => {
    set(_baseJetstreamActiveOrganizationState, newValue);
    setSelectedJetstreamOrganizationFromStorage(newValue);
  },
);

export const jetstreamActiveOrganizationSelector = atom((get) => {
  const organizations = get(jetstreamOrganizationsWithOrgsSelector);
  const selectedItemId = get(jetstreamActiveOrganizationState);
  return organizations.find((org) => org.id === selectedItemId);
});

export const salesforceOrgsAsyncState = atom<Promise<SalesforceOrgUi[]> | SalesforceOrgUi[]>(getOrgsFromStorage());
// Unwrapped value to simplify derived state
export const salesforceOrgsState = unwrap(salesforceOrgsAsyncState, (prev) => prev ?? []);

export const salesforceOrgsForOrganizationSelector = atom((get) => {
  const salesforceOrgs = get(salesforceOrgsState);
  const selectedOrganizationId = get(jetstreamActiveOrganizationState) || null;
  return salesforceOrgs.filter((org) => (org.jetstreamOrganizationId || null) === selectedOrganizationId);
});

export const selectedOrgIdState = atom<Maybe<string>>(getSelectedOrgFromStorage());

export const salesforceOrgsWithoutOrganizationSelector = atom((get) => {
  const orgs = get(salesforceOrgsState);
  return orderObjectsBy(
    orgs.filter((org) => !org.jetstreamOrganizationId),
    'label',
  );
});

export const selectedOrgStateWithoutPlaceholder = atom((get) => {
  const salesforceOrgs = get(salesforceOrgsState);
  const selectedOrgId = get(selectedOrgIdState);
  if (isString(selectedOrgId) && Array.isArray(salesforceOrgs)) {
    return salesforceOrgs.find((org) => org.uniqueId === selectedOrgId);
  }
  return undefined;
});

/**
 * If no org is selected, this returns a placeholder
 * it is expected that any component with an org required
 * will be wrapped in an <OrgSelectionRequired> component to guard against this
 */
export const selectedOrgState = atom((get) => {
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
  const org = get(selectedOrgStateWithoutPlaceholder);
  return org || PLACEHOLDER;
});

export const salesforceOrgsOmitSelectedState = atom((get) => {
  const salesforceOrgs = get(salesforceOrgsState);
  const selectedOrgId = get(selectedOrgIdState);
  if (isString(selectedOrgId) && Array.isArray(salesforceOrgs)) {
    return salesforceOrgs.filter((org) => org.uniqueId !== selectedOrgId);
  }
  return salesforceOrgs;
});

export const selectSkipFrontdoorAuth = atom((get) => {
  if (isBrowserExtension()) {
    return true;
  }
  const userProfile = get(userProfileSyncState);
  return userProfile?.preferences?.skipFrontdoorLogin ?? false;
});

export const salesforceOrgsById = atom((get) => {
  const salesforceOrgs = get(salesforceOrgsState) || [];
  return groupByFlat(salesforceOrgs, 'uniqueId');
});

export const hasConfiguredOrgState = atom((get) => {
  const salesforceOrgs = get(salesforceOrgsState);
  return salesforceOrgs?.length > 0 || false;
});

export const selectedOrgType = atom<Maybe<SalesforceOrgUiType>>((get) => {
  const org = get(selectedOrgStateWithoutPlaceholder);
  return getOrgType(org);
});

export const selectUserPreferenceState = atom<Promise<UserProfilePreferences>>(async (get) => {
  const userPreferences = await get(userPreferenceState);
  return userPreferences;
});

export const useUserPreferenceState = (): [UserProfilePreferences | undefined, (pref: UserProfilePreferences) => void] => {
  const [userPreference] = useAtom(selectUserPreferenceState);
  const setUserPreferenceState = useSetAtom(userPreferenceState);

  async function setUserPreferences(_userPreference: UserProfilePreferences) {
    setUserPreferenceState(Promise.resolve(_userPreference));
    try {
      localforage.setItem<UserProfilePreferences>(INDEXED_DB.KEYS.userPreferences, _userPreference);
    } catch (ex) {
      // could not save to localstorage
      logger.warn('could not save to localstorage');
    }
  }

  return [userPreference, setUserPreferences];
};
