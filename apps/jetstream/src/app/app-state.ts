import { atom, selector } from 'recoil';
import isString from 'lodash/isString';
import { SalesforceOrg, UserProfile, ApplicationCookie } from '@jetstream/types';
import { getUserProfile } from '@jetstream/shared/data';
import { parseCookie } from '@jetstream/shared/ui-utils';
import { HTTP } from '@jetstream/shared/constants';

export const STORAGE_KEYS = {
  ORG_STORAGE_KEY: `ORGS`,
  SELECTED_ORG_STORAGE_KEY: `SELECTED_ORG`,
};

async function getOrgsFromStorage(): Promise<SalesforceOrg[]> {
  try {
    const orgsJsonBase64 = localStorage.getItem(STORAGE_KEYS.ORG_STORAGE_KEY);
    if (isString(orgsJsonBase64)) {
      return JSON.parse(atob(orgsJsonBase64));
    }
    return [];
  } catch (ex) {
    return [];
  }
}

async function getSelectedOrgFromStorage(): Promise<string | undefined> {
  try {
    const selectedOrgIdBase64 = localStorage.getItem(STORAGE_KEYS.SELECTED_ORG_STORAGE_KEY);
    if (isString(selectedOrgIdBase64)) {
      return atob(selectedOrgIdBase64);
    }
    return undefined;
  } catch (ex) {
    return undefined;
  }
}

async function fetchUserProfile(): Promise<UserProfile> {
  const userProfile = await getUserProfile();
  return userProfile;
}

export const applicationCookieState = atom<ApplicationCookie>({
  key: 'applicationCookieState',
  default: parseCookie<ApplicationCookie>(HTTP.COOKIE.JETSTREAM),
});

export const userProfileState = atom<UserProfile>({
  key: 'userState',
  default: fetchUserProfile(),
});

export const salesforceOrgsState = atom<SalesforceOrg[]>({
  key: 'salesforceOrgsState',
  default: getOrgsFromStorage(),
});

export const selectedOrgIdState = atom<string>({
  key: 'selectedOrgIdState',
  default: getSelectedOrgFromStorage(),
});

export const selectedOrgState = selector({
  key: 'selectedOrgState',
  get: ({ get }) => {
    const salesforceOrgs = get(salesforceOrgsState);
    const selectedOrgId = get(selectedOrgIdState);
    if (isString(selectedOrgId) && Array.isArray(salesforceOrgs)) {
      return salesforceOrgs.find((org) => org.uniqueId === selectedOrgId);
    }
    return undefined;
  },
});

atob(localStorage.getItem(STORAGE_KEYS.SELECTED_ORG_STORAGE_KEY));
