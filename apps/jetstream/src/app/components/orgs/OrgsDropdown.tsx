/** @jsx jsx */
import { jsx } from '@emotion/react';
import { clearCacheForOrg, clearQueryHistoryForOrg, deleteOrg, getOrgs, query, updateOrg } from '@jetstream/shared/data';
import { SalesforceOrgUi } from '@jetstream/types';
import { Badge, Icon, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import orderBy from 'lodash/orderBy';
import uniqBy from 'lodash/uniqBy';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import * as fromAppState from '../../app-state';
import OrgsCombobox from '../../components/core/OrgsCombobox';
import AddOrg from './AddOrg';
import OrgInfoPopover from './OrgInfoPopover';
import OrgPersistence from './OrgPersistence';

interface UserPermissionAccess {
  Id: string;
  PermissionsModifyAllData: boolean;
  PermissionsModifyMetadata: boolean;
}

export const OrgsDropdown: FunctionComponent = () => {
  // Recoil needs to fix this
  const [orgs, setOrgs] = useRecoilState<SalesforceOrgUi[]>(fromAppState.salesforceOrgsState);
  const setSelectedOrgId = useSetRecoilState<string>(fromAppState.selectedOrgIdState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(fromAppState.selectedOrgState);
  const orgType = useRecoilValue(fromAppState.selectedOrgType);
  const [orgLoading, setOrgLoading] = useState(false);
  const [hasMetadataAccess, setHasMetadataAccess] = useState(true);

  useEffect(() => {
    if (selectedOrg) {
      query<UserPermissionAccess>(
        selectedOrg,
        'SELECT Id, PermissionsModifyAllData, PermissionsModifyMetadata FROM UserPermissionAccess'
      ).then(({ queryResults }) => {
        if (queryResults.records.length > 0) {
          setHasMetadataAccess(queryResults.records[0].PermissionsModifyAllData || queryResults.records[0].PermissionsModifyMetadata);
        }
      });
    }
  });

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
        {!hasMetadataAccess && (
          <Tooltip
            id={`limited-org-access`}
            content={`Your user does not have the permission "Modify Metadata Through Metadata API Functions" Or "Modify All Data". Some Jetstream features will not work properly.`}
          >
            <div className={classNames('slds-col slds-p-around_xx-small')}>
              <Badge type="warning" title="Limited Access">
                <Icon type="utility" icon="warning" className="slds-icon_xx-small slds-m-right_xx-small" />
                Limited Access
              </Badge>
            </div>
          </Tooltip>
        )}
        <div className={classNames('slds-col slds-p-around_xx-small')}>
          <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType}>
            {orgType}
          </Badge>
        </div>
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
