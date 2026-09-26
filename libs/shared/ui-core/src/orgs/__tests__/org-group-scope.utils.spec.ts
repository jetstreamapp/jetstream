import { SalesforceOrgUi } from '@jetstream/types';
import { getOrgGroupScope } from '../org-group-scope.utils';

function buildOrg(uniqueId: string, jetstreamOrganizationId: string | null = null): SalesforceOrgUi {
  return { uniqueId, label: uniqueId, username: uniqueId, jetstreamOrganizationId } as SalesforceOrgUi;
}

const acmeProd = buildOrg('acme-prod', 'acme');
const acmeUat = buildOrg('acme-uat', 'acme');
const globexProd = buildOrg('globex-prod', 'globex');
const initechProd = buildOrg('initech-prod', 'initech');
const scratch = buildOrg('scratch');

const orgs = [acmeProd, acmeUat, globexProd, initechProd, scratch];

function uniqueIds(scopedOrgs: SalesforceOrgUi[]) {
  return scopedOrgs.map(({ uniqueId }) => uniqueId);
}

describe('getOrgGroupScope', () => {
  it('hides nothing when no groups are configured', () => {
    const scope = getOrgGroupScope({ orgs, hasOrgGroups: false, activeGroupId: 'acme', selectedOrgId: null });
    expect(scope.scopedOrgs).toBe(orgs);
    expect(scope.hiddenOrgCount).toBe(0);
    expect(scope.hiddenGroupCount).toBe(0);
  });

  it('keeps only the orgs in the active group', () => {
    const scope = getOrgGroupScope({ orgs, hasOrgGroups: true, activeGroupId: 'acme', selectedOrgId: null });
    expect(uniqueIds(scope.scopedOrgs)).toEqual(['acme-prod', 'acme-uat']);
    expect(scope.hiddenOrgCount).toBe(3);
  });

  it('keeps only ungrouped orgs when no group is active', () => {
    const scope = getOrgGroupScope({ orgs, hasOrgGroups: true, activeGroupId: null, selectedOrgId: null });
    expect(uniqueIds(scope.scopedOrgs)).toEqual(['scratch']);
    expect(scope.hiddenOrgCount).toBe(4);
    expect(scope.hiddenGroupCount).toBe(3);
  });

  it('counts ungrouped orgs as one hidden group', () => {
    const scope = getOrgGroupScope({ orgs, hasOrgGroups: true, activeGroupId: 'acme', selectedOrgId: null });
    // globex, initech and the ungrouped bucket
    expect(scope.hiddenGroupCount).toBe(3);
  });

  /** Otherwise the combobox cannot resolve a label for the selection and the input renders blank */
  it('keeps the selected org even when it is outside the active group', () => {
    const scope = getOrgGroupScope({ orgs, hasOrgGroups: true, activeGroupId: 'acme', selectedOrgId: 'globex-prod' });
    expect(uniqueIds(scope.scopedOrgs)).toEqual(['acme-prod', 'acme-uat', 'globex-prod']);
    expect(scope.hiddenOrgCount).toBe(2);
    expect(scope.hiddenGroupCount).toBe(2);
  });

  it('hides nothing when every org is already in the active group', () => {
    const scope = getOrgGroupScope({ orgs: [acmeProd, acmeUat], hasOrgGroups: true, activeGroupId: 'acme', selectedOrgId: null });
    expect(scope.hiddenOrgCount).toBe(0);
    expect(scope.hiddenGroupCount).toBe(0);
  });
});
