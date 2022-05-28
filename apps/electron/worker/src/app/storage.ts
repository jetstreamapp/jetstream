import { ipcRenderer } from 'electron';
import localforage from 'localforage';
import { SalesforceOrgElectron } from './types';

const KEYS = {
  orgs: 'ORGS',
  user: 'USER',
};

const orgsPromise = (async () => {
  initOrgs(await ipcRenderer.invoke('init-orgs'));
})();

let ORGS: SalesforceOrgElectron[] = [];
let userInfo: any; // TODO: type me

export function initOrgs(orgs: SalesforceOrgElectron[]) {
  ORGS = orgs;
}

export function saveUserInfo(_userInfo: any) {
  userInfo = _userInfo;
}

export function getUserInfo() {
  return userInfo;
}

/**
 * ORGS
 */
export async function getOrgs() {
  // console.log(localforage);
  // return (await localforage.getItem<SalesforceOrgElectron[]>(KEYS.orgs)) || [];
  await orgsPromise;
  return ORGS;
}

export async function getOrg(uniqueId: string) {
  return (await getOrgs()).find((org) => org.uniqueId === uniqueId);
}

export async function updateOrg(uniqueId: string, org: Partial<SalesforceOrgElectron>) {
  let updatedOrg: SalesforceOrgElectron;
  const orgs = (await getOrgs()).map((currOrg) => {
    if (currOrg.uniqueId === uniqueId) {
      updatedOrg = { ...currOrg, ...org };
      return updatedOrg;
    }
    return currOrg;
  });
  // await localforage.setItem<SalesforceOrgElectron[]>(KEYS.orgs, orgs);
  await ipcRenderer.invoke('set-orgs', orgs);
  ORGS = orgs;
  return updatedOrg;
}

export async function saveOrg(org: SalesforceOrgElectron) {
  const orgs = (await getOrgs()).filter((currOrg) => currOrg.uniqueId !== org.uniqueId);
  orgs.push(org);
  // return await localforage.setItem<SalesforceOrgElectron[]>(KEYS.orgs, orgs);
  await ipcRenderer.invoke('set-orgs', orgs);
  ORGS = orgs;
  return orgs;
}

export async function deleteOrg(uniqueId: string) {
  const orgs = (await getOrgs()).filter((currOrg) => currOrg.uniqueId !== uniqueId);
  await localforage.setItem<SalesforceOrgElectron[]>(KEYS.orgs, orgs);
  await ipcRenderer.invoke('set-orgs', orgs);
  ORGS = orgs;
}
