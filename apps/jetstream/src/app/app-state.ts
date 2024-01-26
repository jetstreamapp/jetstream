export {
  actionInProgressState,
  appVersionState,
  applicationCookieState,
  electronPreferences,
  hasConfiguredOrgState,
  salesforceOrgsById,
  salesforceOrgsOmitSelectedState,
  salesforceOrgsState,
  selectUserPreferenceState,
  selectedOrgIdState,
  selectedOrgState,
  selectedOrgStateWithoutPlaceholder,
  selectedOrgType,
  useUserPreferenceState,
  userProfileState,
} from '@jetstream/core/app';

export const STORAGE_KEYS = {
  SELECTED_ORG_STORAGE_KEY: `SELECTED_ORG`,
  ANONYMOUS_APEX_STORAGE_KEY: `ANONYMOUS_APEX`,
};

/**
 * Parse application state with a fallback in case there is an issue parsing
 */
// function getAppCookie(): ApplicationCookie {
//   let appState = window.electron?.isElectron ? window.electron.appCookie : parseCookie<ApplicationCookie>(HTTP.COOKIE.JETSTREAM);
//   appState = appState
//     ? { ...appState }
//     : {
//         serverUrl: 'http://localhost:3333',
//         environment: 'development',
//         defaultApiVersion: 'v54.0',
//         google_appId: '1071580433137',
//         google_apiKey: 'AIzaSyDaqv3SafGq6NmVVwUWqENrf2iEFiDSMoA',
//         google_clientId: '1094188928456-fp5d5om6ar9prdl7ak03fjkqm4fgagoj.apps.googleusercontent.com',
//       };
//   appState.serverUrl = appState.serverUrl || 'https://getjetstream.app/';
//   appState.environment = appState.environment || 'production';
//   appState.defaultApiVersion = appState.defaultApiVersion || 'v54.0';
//   appState.google_appId = appState.google_appId || '1071580433137';
//   appState.google_apiKey = appState.google_apiKey || 'AIzaSyDaqv3SafGq6NmVVwUWqENrf2iEFiDSMoA';
//   appState.google_clientId = appState.google_clientId || '1094188928456-fp5d5om6ar9prdl7ak03fjkqm4fgagoj.apps.googleusercontent.com';

//   // if electron, ensure good defaults are set
//   if (window.electron?.isElectron) {
//     appState.serverUrl = 'http://localhost';
//     appState.environment = window.electron?.isElectronDev ? 'development' : 'production';
//   }
//   return appState;
// }

// function ensureUserProfileInit(pref?: Maybe<UserProfilePreferences>): UserProfilePreferences {
//   return {
//     // CURRENT
//     ...pref,
//   };
// }

// async function getUserPreferences(): Promise<UserProfilePreferences> {
//   try {
//     const userPreferences = await localforage.getItem<UserProfilePreferences>(INDEXED_DB.KEYS.userPreferences);
//     return ensureUserProfileInit(userPreferences);
//   } catch (ex) {
//     return ensureUserProfileInit();
//   }
// }

// async function getOrgsFromStorage(): Promise<SalesforceOrgUi[]> {
//   try {
//     const orgs = await getOrgs();
//     return orgs || [];
//   } catch (ex) {
//     return [];
//   }
// }

// async function getSelectedOrgFromStorage(): Promise<string | undefined> {
//   try {
//     const selectedOrgIdBase64 =
//       sessionStorage.getItem(STORAGE_KEYS.SELECTED_ORG_STORAGE_KEY) || localStorage.getItem(STORAGE_KEYS.SELECTED_ORG_STORAGE_KEY);
//     if (isString(selectedOrgIdBase64)) {
//       return atob(selectedOrgIdBase64);
//     }
//     return undefined;
//   } catch (ex) {
//     return undefined;
//   }
// }

// async function fetchAppVersion() {
//   try {
//     return await checkHeartbeat();
//   } catch (ex) {
//     return { version: 'unknown' };
//   }
// }

// async function fetchUserProfile(): Promise<UserProfileUi> {
//   const userProfile = await getUserProfile();
//   return userProfile;
// }

// const userPreferenceState = atom<UserProfilePreferences>({
//   key: 'userPreferenceState',
//   default: getUserPreferences(),
// });

// export const actionInProgressState = atom<boolean>({
//   key: 'actionInProgressState',
//   default: false,
// });

// export const applicationCookieState = atom<ApplicationCookie>({
//   key: 'applicationCookieState',
//   default: getAppCookie(),
// });

// export const appVersionState = atom<{ version: string }>({
//   key: 'appVersionState',
//   default: fetchAppVersion(),
// });

// export const userProfileState = atom<UserProfileUi>({
//   key: 'userState',
//   default: fetchUserProfile(),
// });

// export const electronPreferences = atom<ElectronPreferences>({
//   key: 'electronPreferences',
//   default: window.electron?.initialPreferences,
// });

// export const salesforceOrgsState = atom<SalesforceOrgUi[]>({
//   key: 'salesforceOrgsState',
//   default: getOrgsFromStorage(),
// });

// export const selectedOrgIdState = atom<Maybe<string>>({
//   key: 'selectedOrgIdState',
//   default: getSelectedOrgFromStorage(),
// });

// export const selectedOrgStateWithoutPlaceholder = selector({
//   key: 'selectedOrgStateWithoutPlaceholder',
//   get: ({ get }) => {
//     const salesforceOrgs = get(salesforceOrgsState);
//     const selectedOrgId = get(selectedOrgIdState);
//     if (isString(selectedOrgId) && Array.isArray(salesforceOrgs)) {
//       return salesforceOrgs.find((org) => org.uniqueId === selectedOrgId);
//     }
//     return undefined;
//   },
// });

/**
 * If no org is selected, this returns a placeholder
 * it is expected that any component with an org required
 * will be wrapped in an <OrgSelectionRequired> component to guard against this
 */
// export const selectedOrgState = selector({
//   key: 'selectedOrgState',
//   get: ({ get }) => {
//     const PLACEHOLDER: SalesforceOrgUi = {
//       uniqueId: '',
//       label: '',
//       filterText: '',
//       accessToken: '',
//       instanceUrl: '',
//       loginUrl: '',
//       userId: '',
//       email: '',
//       organizationId: '',
//       username: '',
//       displayName: '',
//     };
//     return get(selectedOrgStateWithoutPlaceholder) || PLACEHOLDER;
//   },
// });

// export const salesforceOrgsOmitSelectedState = selector({
//   key: 'salesforceOrgsOmitSelectedState',
//   get: ({ get }) => {
//     const salesforceOrgs = get(salesforceOrgsState);
//     const selectedOrgId = get(selectedOrgIdState);
//     if (isString(selectedOrgId) && Array.isArray(salesforceOrgs)) {
//       return salesforceOrgs.filter((org) => org.uniqueId !== selectedOrgId);
//     }
//     return salesforceOrgs;
//   },
// });

// export const salesforceOrgsById = selector({
//   key: 'salesforceOrgsById',
//   get: ({ get }) => {
//     const salesforceOrgs = get(salesforceOrgsState) || [];
//     return getMapOf(salesforceOrgs, 'uniqueId');
//   },
// });

// export const hasConfiguredOrgState = selector({
//   key: 'hasConfiguredOrgState',
//   get: ({ get }) => {
//     const salesforceOrgs = get(salesforceOrgsState);
//     return salesforceOrgs?.length > 0 || false;
//   },
// });

// export const selectedOrgType = selector<Maybe<SalesforceOrgUiType>>({
//   key: 'selectedOrgType',
//   get: ({ get }) => getOrgType(get(selectedOrgStateWithoutPlaceholder)),
// });

// export const selectUserPreferenceState = selector<UserProfilePreferences>({
//   key: 'selectUserPreferenceState',
//   get: ({ get }) => {
//     const userPreferences = get(userPreferenceState);
//     return userPreferences;
//   },
//   // https://rollbar.com/jetstream/Jetstream/items/519/
//   // Causes error when used because this is async and async set selectors are not allowed
//   // set: async ({ set }, userPreferences: UserProfilePreferences) => {
//   //   set(userPreferenceState, userPreferences);
//   //   try {
//   //     await localforage.setItem<UserProfilePreferences>(INDEXED_DB.KEYS.userPreferences, userPreferences);
//   //   } catch (ex) {
//   //     // could not save to localstorage
//   //   }
//   // },
// });

// export const useUserPreferenceState = (): [UserProfilePreferences, (pref: UserProfilePreferences) => void] => {
//   const userPreference = useRecoilValue(selectUserPreferenceState);
//   const setUserPreferenceState = useSetRecoilState(userPreferenceState);

//   async function setUserPreferences(_userPreference: UserProfilePreferences) {
//     setUserPreferenceState(_userPreference);
//     try {
//       localforage.setItem<UserProfilePreferences>(INDEXED_DB.KEYS.userPreferences, _userPreference);
//     } catch (ex) {
//       // could not save to localstorage
//       logger.warn('could not save to localstorage');
//     }
//   }

//   return [userPreference, setUserPreferences];
// };
