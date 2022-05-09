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

export async function updateOrg(org: SalesforceOrgElectron) {
  const orgs = (await getOrgs()).map((currOrg) => {
    if (currOrg.uniqueId === org.uniqueId) {
      return { currOrg, ...org };
    }
    return currOrg;
  });
  return await localforage.setItem<SalesforceOrgElectron[]>(KEYS.orgs, orgs);
}

export async function saveOrg(org: SalesforceOrgElectron) {
  const orgs = (await getOrgs()).filter((currOrg) => currOrg.uniqueId !== org.uniqueId);
  orgs.push(org);
  return await localforage.setItem<SalesforceOrgElectron[]>(KEYS.orgs, orgs);
}
