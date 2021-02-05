/** @jsx jsx */
import { jsx } from '@emotion/react';
import { clearCacheForOrg, clearQueryHistoryForOrg, deleteOrg, getOrgs, updateOrg } from '@jetstream/shared/data';
import { SalesforceOrgUi } from '@jetstream/types';
import { Badge } from '@jetstream/ui';
import classNames from 'classnames';
import orderBy from 'lodash/orderBy';
import uniqBy from 'lodash/uniqBy';
import { Fragment, FunctionComponent, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import * as fromAppState from '../../app-state';
import OrgsCombobox from '../../components/core/OrgsCombobox';
import AddOrg from './AddOrg';
import OrgInfoPopover from './OrgInfoPopover';
import OrgPersistence from './OrgPersistence';

export const OrgsDropdown: FunctionComponent = () => {
  // Recoil needs to fix this
  const [orgs, setOrgs] = useRecoilState<SalesforceOrgUi[]>(fromAppState.salesforceOrgsState);
  const setSelectedOrgId = useSetRecoilState<string>(fromAppState.selectedOrgIdState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(fromAppState.selectedOrgState);
  const orgType = useRecoilValue(fromAppState.selectedOrgType);
  const [orgLoading, setOrgLoading] = useState(false);

  /**
   *
   * @param org Org to add
   * @param replaceOrgUniqueId Id of org that should be removed from list. Only applicable to fixing org where Id ends up being different
   */
  function handleAddOrg(org: SalesforceOrgUi, replaceOrgUniqueId?: string) {
    const sortedOrgs = uniqBy(
      orderBy([org, ...orgs.filter((org) => (replaceOrgUniqueId ? org.uniqueId !== replaceOrgUniqueId : true))], 'username'),
      'uniqueId'
    );
    setOrgs(sortedOrgs);
    setSelectedOrgId(org.uniqueId);
  }

  async function handleRemoveOrg(org: SalesforceOrgUi) {
    try {
      await deleteOrg(org);
      setOrgs(await getOrgs());
      setSelectedOrgId(undefined);
      // async, but results are ignored as this will not throw
      clearCacheForOrg(org);
      clearQueryHistoryForOrg(org);
    } catch (ex) {
      // TODO:
    }
  }

  async function handleUpdateOrg(org: SalesforceOrgUi, updatedOrg: Partial<SalesforceOrgUi>) {
    try {
      setOrgLoading(true);
      await updateOrg(org, updatedOrg);
      setOrgs(await getOrgs());
    } catch (ex) {
      // TODO:
    } finally {
      setOrgLoading(false);
    }
  }

  return (
    <Fragment>
      <OrgPersistence />
      <div className="slds-grid slds-grid-no-wrap">
        {
          <div className={classNames('slds-col slds-p-around_xx-small')}>
            <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType}>
              {orgType}
            </Badge>
          </div>
        }
        <OrgsCombobox orgs={orgs} selectedOrg={selectedOrg} onSelected={(org: SalesforceOrgUi) => setSelectedOrgId(org.uniqueId)} />
        {selectedOrg && (
          <div className="slds-col slds-m-left--xx-small slds-p-top--xx-small">
            <OrgInfoPopover
              org={selectedOrg}
              loading={orgLoading}
              onAddOrg={handleAddOrg}
              onRemoveOrg={handleRemoveOrg}
              onSaveLabel={handleUpdateOrg}
            />
          </div>
        )}
        <div className="slds-col">
          <AddOrg onAddOrg={handleAddOrg} />
        </div>
      </div>
    </Fragment>
  );
};

export default OrgsDropdown;
