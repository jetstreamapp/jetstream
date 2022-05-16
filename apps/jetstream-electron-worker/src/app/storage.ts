import localforage from 'localforage';
import { SalesforceOrgElectron } from './types';

const KEYS = {
  orgs: 'ORGS',
  user: 'USER',
};

/**
 * ORGS
 */
export async function getOrgs() {
  return (await localforage.getItem<SalesforceOrgElectron[]>(KEYS.orgs)) || [];
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
  await localforage.setItem<SalesforceOrgElectron[]>(KEYS.orgs, orgs);
  return updatedOrg;
}

export async function saveOrg(org: SalesforceOrgElectron) {
  const orgs = (await getOrgs()).filter((currOrg) => currOrg.uniqueId !== org.uniqueId);
  orgs.push(org);
  return await localforage.setItem<SalesforceOrgElectron[]>(KEYS.orgs, orgs);
}

export async function deleteOrg(uniqueId: string) {
  const orgs = (await getOrgs()).filter((currOrg) => currOrg.uniqueId !== uniqueId);
  await localforage.setItem<SalesforceOrgElectron[]>(KEYS.orgs, orgs);
}
