import { getUserAbility } from '@jetstream/acl';
import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { checkHeartbeat, getOrgGroups, getOrgs, getUserProfile } from '@jetstream/shared/data';
import {
  getBrowserExtensionVersion,
  getOrgType,
  isBrowserExtension,
  isCanvasApp,
  isDesktop,
  setItemInLocalStorage,
  setItemInSessionStorage,
  verifyAndExtractFeatureFlags,
} from '@jetstream/shared/ui-utils';
import { getDefaultAppState, groupByFlat, orderObjectsBy } from '@jetstream/shared/utils';
import {
  AppInfo,
  DEFAULT_FEATURE_FLAGS,
  SoqlQueryFormatOptions,
  SoqlQueryFormatOptionsSchema,
  TeamBillingStatusSchema,
  type Announcement,
  type ApplicationState,
  type FeatureFlagKey,
  type FeatureFlags,
  type Maybe,
  type OrgGroup,
  type OrgGroupWithOrgs,
  type SalesforceOrgUi,
  type SalesforceOrgUiType,
  type UserProfilePreferences,
  type UserProfileUi,
} from '@jetstream/types';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { unwrap } from 'jotai/utils';
import localforage from 'localforage';
import isString from 'lodash/isString';
import z from 'zod';

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
    soqlQueryFormatOptions: SoqlQueryFormatOptionsSchema.parse({}),
  },
  entitlements: {
    googleDrive: false,
    chromeExtension: false,
    desktop: false,
    recordSync: false,
    analysisTools: false,
    salesforceCanvas: false,
  },
  subscriptions: [],
  featureFlags: DEFAULT_FEATURE_FLAGS,
} as UserProfileUi;

export const STORAGE_KEYS = {
  SELECTED_ORG_STORAGE_KEY: `SELECTED_ORG`,
  RECENTLY_SELECTED_ORGS_STORAGE_KEY: `RECENTLY_SELECTED_ORGS`,
  SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY: `SELECTED_JETSTREAM_ORGANIZATION`,
  ANONYMOUS_APEX_STORAGE_KEY: `ANONYMOUS_APEX`,
  PLATFORM_EVENT_SORT_COLUMNS: `PLATFORM_EVENT_SORT_COLUMNS`,
};

const NO_GROUP_KEY = 'NO_GROUP';

type RecentlySelectedOrgsMap = Record<string, string>;

function getWebServerUrl(): string {
  return import.meta.env.NX_PUBLIC_SERVER_URL || 'https://getjetstream.app';
}

/**
 * Desktop's main process hardcodes SERVER_URL based on `app.isPackaged`, so the
 * renderer must not rely on any inlined `NX_PUBLIC_SERVER_URL` during bootstrap
 * — a local package build may still bake in localhost. The packaged app's
 * heartbeat returns the correct URL; use production as the pre-heartbeat
 * fallback.
 */
function getBootstrapAppInfo(): ApplicationState {
  const serverUrl = isDesktop() ? 'https://getjetstream.app' : getWebServerUrl();
  const defaultState = getDefaultAppState({ serverUrl });
  // Canvas app: use the current origin as serverUrl since the canvas app
  // and landing page are served from the same host
  if (isCanvasApp()) {
    defaultState.serverUrl = window.location.origin;
  }
  return defaultState;
}

function ensureUserProfileInit(pref?: Maybe<UserProfilePreferences>): UserProfilePreferences {
  return {
    colorScheme: 'light',
    ...pref,
  };
}

async function getUserPreferences(): Promise<UserProfilePreferences> {
  try {
    const userPreferences = await localforage.getItem<UserProfilePreferences>(INDEXED_DB.KEYS.userPreferences);
    return ensureUserProfileInit(userPreferences);
  } catch {
    return ensureUserProfileInit();
  }
}

async function getOrgsFromStorage(): Promise<SalesforceOrgUi[]> {
  try {
    const isSingleOrgMode = isBrowserExtension() || isCanvasApp();
    const orgs = isSingleOrgMode ? [] : await getOrgs();
    return orgs || [];
  } catch {
    return [];
  }
}

async function fetchOrgGroups(): Promise<OrgGroup[]> {
  try {
    const isSingleOrgMode = isBrowserExtension() || isCanvasApp();
    const orgs = isSingleOrgMode ? [] : await getOrgGroups();
    return orgs || [];
  } catch {
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
  } catch {
    return undefined;
  }
}

function getSelectedOrgGroupFromStorage(): Maybe<string> {
  try {
    return (
      sessionStorage.getItem(STORAGE_KEYS.SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY) ||
      localStorage.getItem(STORAGE_KEYS.SELECTED_JETSTREAM_ORGANIZATION_STORAGE_KEY)
    );
  } catch {
    return undefined;
  }
}

function setSelectedOrgGroupFromStorage(id: Maybe<string>) {
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

function getRecentlySelectedOrgsFromStorage(): RecentlySelectedOrgsMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.RECENTLY_SELECTED_ORGS_STORAGE_KEY);
    if (stored) {
      return z.record(z.string(), z.string()).parse(JSON.parse(stored));
    }
    return {};
  } catch {
    return {};
  }
}

export function setRecentlySelectedOrgsToStorage({ groupId, orgId }: { groupId: Maybe<string>; orgId: string }) {
  try {
    const map = getRecentlySelectedOrgsFromStorage();
    map[groupId || NO_GROUP_KEY] = orgId;
    setItemInLocalStorage(STORAGE_KEYS.RECENTLY_SELECTED_ORGS_STORAGE_KEY, JSON.stringify(z.record(z.string(), z.string()).parse(map)));
  } catch (ex) {
    logger.warn('could not save recently selected orgs to localstorage', ex);
  }
}

export function getRecentlySelectedOrgForGroup(groupId: Maybe<string>): Maybe<string> {
  const map = getRecentlySelectedOrgsFromStorage();
  return map[groupId || NO_GROUP_KEY] || null;
}

const DEFAULT_APP_INFO: AppInfo = { appInfo: getBootstrapAppInfo(), version: 'unknown', announcements: [] as Announcement[] };

async function fetchAppInfo(): Promise<AppInfo> {
  try {
    if (isBrowserExtension() || isCanvasApp()) {
      return { appInfo: getBootstrapAppInfo(), version: getBrowserExtensionVersion(), announcements: [] };
    }
    return await checkHeartbeat();
  } catch {
    return DEFAULT_APP_INFO;
  }
}

async function fetchUserProfile(): Promise<UserProfileUi> {
  if (isBrowserExtension() || isCanvasApp()) {
    return DEFAULT_PROFILE;
  }
  const userProfile = await getUserProfile().catch(() => DEFAULT_PROFILE);
  // Verify the server's signature once here so downstream atoms read trusted flags synchronously.
  // On any failure this returns code defaults (fail-safe), so we never trust a tampered payload.
  const featureFlags = await verifyAndExtractFeatureFlags(userProfile);
  return { ...userProfile, featureFlags };
}

const userPreferenceState = atom<Promise<UserProfilePreferences>>(getUserPreferences());

export const actionInProgressState = atom<boolean>(false);

/**
 * Whether local Data History capture is currently active. Seeded once during app init (each
 * AppInitializer calls `isDataHistoryCaptureEnabled()` after `initDataHistory()` and writes the
 * result here) so feature code can read it synchronously instead of awaiting an async check on
 * mount. Settings UI that toggles capture should update this atom too.
 */
export const dataHistoryCaptureEnabledState = atom<boolean>(false);

/**
 * Whether Data History has finished initializing for this session (tier limits resolved). Seeded to
 * true by each AppInitializer right after `initDataHistory()`. UI that renders only once history is
 * ready (e.g. the Settings section) gates its first load on this — otherwise a hard refresh landing
 * directly on that page renders before init completes and then never retries.
 */
export const dataHistoryInitializedState = atom<boolean>(false);

export const appInfoState = atom<Promise<AppInfo> | AppInfo>(fetchAppInfo());
export const appInfoSyncState = unwrap(appInfoState, (prev) => prev ?? DEFAULT_APP_INFO);

export const applicationCookieState = atom((get) => get(appInfoSyncState).appInfo);
export const appVersionState = atom((get) => get(appInfoSyncState).version);
export const AnnouncementState = atom((get) => get(appInfoSyncState).announcements);

export const isBrowserExtensionState = atom<boolean>(isBrowserExtension());

export const userProfileState = atom<Promise<UserProfileUi> | UserProfileUi>(fetchUserProfile());

export const analyticsState = atom<'accepted' | 'rejected' | null>(null);

/**
 * This is for internal use for derived state to avoid async issues.
 * Use `userProfileState` for components.
 */
export const userProfileSyncState = unwrap(userProfileState, (prev) => prev ?? DEFAULT_PROFILE);

export const isReadOnlyUserState = atom((get) => {
  const userProfile = get(userProfileSyncState);
  return userProfile.teamMembership?.role === 'BILLING';
});

/**
 * Resolved + signature-verified feature flags for the current user (see `verifyAndExtractFeatureFlags`).
 * Merged over code defaults so every known flag is always present. Prefer the `useFeatureFlag` hook.
 */
export const featureFlagsState = atom<FeatureFlags>((get) => {
  const userProfile = get(userProfileSyncState);
  return { ...DEFAULT_FEATURE_FLAGS, ...userProfile.featureFlags } as FeatureFlags;
});

/** Returns whether a single feature flag is enabled for the current user. */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const featureFlags = useAtomValue(featureFlagsState);
  return featureFlags[key] ?? DEFAULT_FEATURE_FLAGS[key];
}

export const abilityState = atom((get) => {
  const userProfile = get(userProfileSyncState);
  return getUserAbility({
    isBrowserExtension: isBrowserExtension(),
    isDesktop: isDesktop(),
    isCanvasApp: isCanvasApp(),
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
    hasGoogleDriveAccess: ability.can('access', 'GoogleDrive'),
    // Only show upgrade prompt on web (desktop/extension users already have access)
    googleShowUpgradeToPro: !isChromeExtension && !isDesktop() && !isCanvasApp() && ability.cannot('access', 'GoogleDrive'),
  };
});

/**
 * Access to the paid-only Analysis Tools (Field Usage + Permission Analysis). Granted by the dedicated
 * `analysisTools` entitlement (for future per-org/trial control) OR any active paid plan, so existing
 * paid users keep access before the entitlement is provisioned. Processing is browser-only, so this is
 * the sole gate — there is no server-side enforcement.
 */
export const analysisToolsAccessState = atom((get) => {
  const ability = get(abilityState);
  const hasPaidPlan = get(hasPaidPlanState);
  const hasAnalysisToolsAccess = ability.can('access', 'AnalysisTools') || hasPaidPlan;
  return {
    hasAnalysisToolsAccess,
    // Only prompt upgrade on web; desktop/extension/canvas are paid tiers and granted via ability.
    analysisShowUpgradeToPro: !hasAnalysisToolsAccess && !get(isBrowserExtensionState) && !isDesktop() && !isCanvasApp(),
  };
});

export const orgGroupsAsyncState = atom<Promise<OrgGroup[]> | OrgGroup[]>(fetchOrgGroups());
// Unwrapped value to simplify derived state
export const orgGroupsState = unwrap(orgGroupsAsyncState, (prev) => prev ?? []);
export const orgGroupsResolvedState = unwrap(orgGroupsAsyncState);

// Combine orgs with organizations
export const orgGroupsWithOrgsSelector = atom(
  (get) => {
    const orgsById = get(salesforceOrgsById);
    const orgGroups = get(orgGroupsState);
    return orgGroups.map((group) => ({
      ...group,
      orgs: group.orgs.map(({ uniqueId }) => orgsById[uniqueId]).filter(Boolean),
    }));
  },
  (get, set, newValue: OrgGroupWithOrgs[]) => {
    set(
      orgGroupsState,
      newValue.map((group) => ({
        ...group,
        orgs: group.orgs.map(({ uniqueId }) => ({ uniqueId })),
      })),
    );
  },
);

export const orgGroupExistsSelector = atom((get) => {
  const organizations = get(orgGroupsState);
  return organizations.length > 0;
});

const _baseActiveOrgGroupState = atom<Maybe<string>>(getSelectedOrgGroupFromStorage());

export const ActiveOrgGroupState = atom(
  (get) => get(_baseActiveOrgGroupState),
  (get, set, newValue: Maybe<string>) => {
    set(_baseActiveOrgGroupState, newValue);
    setSelectedOrgGroupFromStorage(newValue);
  },
);

export const jetstreamActiveGroupSelector = atom((get) => {
  const groups = get(orgGroupsWithOrgsSelector);
  const selectedItemId = get(ActiveOrgGroupState);
  return groups.find(({ id }) => id === selectedItemId);
});

export const salesforceOrgsAsyncState = atom<Promise<SalesforceOrgUi[]> | SalesforceOrgUi[]>(getOrgsFromStorage());
// Unwrapped value to simplify derived state
export const salesforceOrgsState = unwrap(salesforceOrgsAsyncState, (prev) => prev ?? []);

export const salesforceOrgsForGroupSelector = atom((get) => {
  const salesforceOrgs = get(salesforceOrgsState);
  const selectedGroupId = get(ActiveOrgGroupState) || null;
  return salesforceOrgs.filter((org) => (org.jetstreamOrganizationId || null) === selectedGroupId);
});

export const selectedOrgIdState = atom<Maybe<string>>(getSelectedOrgFromStorage());

export const salesforceOrgsWithoutGroupSelector = atom((get) => {
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

export const soqlQueryFormatOptionsState = atom(
  (get) => {
    const userProfile = get(userProfileSyncState);
    return userProfile?.preferences?.soqlQueryFormatOptions ?? SoqlQueryFormatOptionsSchema.parse({});
  },
  (get, set, soqlQueryFormatOptions: SoqlQueryFormatOptions) => {
    const userProfile = get(userProfileSyncState);
    set(userProfileSyncState, { ...userProfile, preferences: { ...userProfile.preferences, soqlQueryFormatOptions } });
  },
);

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
    } catch {
      // could not save to localstorage
      logger.warn('could not save to localstorage');
    }
  }

  return [userPreference, setUserPreferences];
};
