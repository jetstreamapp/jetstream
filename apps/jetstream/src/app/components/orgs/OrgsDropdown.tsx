/** @jsx jsx */
import { jsx } from '@emotion/react';
import { clearCacheForOrg, clearQueryHistoryForOrg, deleteOrg, getOrgs, updateOrg } from '@jetstream/shared/data';
import { useObservable } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Badge, Icon, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import orderBy from 'lodash/orderBy';
import uniqBy from 'lodash/uniqBy';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { Observable } from 'rxjs';
import * as fromAppState from '../../app-state';
import OrgsCombobox from '../../components/core/OrgsCombobox';
import * as fromJetstreamEvents from '../core/jetstream-events';
import AddOrg from './AddOrg';
import OrgInfoPopover from './OrgInfoPopover';
import OrgPersistence from './OrgPersistence';
import { useOrgPermissions } from './useOrgPermissions';

export const OrgsDropdown: FunctionComponent = () => {
  const [orgs, setOrgs] = useRecoilState<SalesforceOrgUi[]>(fromAppState.salesforceOrgsState);
  const setSelectedOrgId = useSetRecoilState<string>(fromAppState.selectedOrgIdState);
  const actionInProgress = useRecoilValue<boolean>(fromAppState.actionInProgressState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(fromAppState.selectedOrgState);
  const orgType = useRecoilValue(fromAppState.selectedOrgType);
  const [orgLoading, setOrgLoading] = useState(false);
  const { hasMetadataAccess } = useOrgPermissions(selectedOrg);

  // subscribe to org changes from other places in the application
  const onAddOrgFromExternalSource = useObservable(
    fromJetstreamEvents.getObservable('addOrg') as Observable<fromJetstreamEvents.JetstreamEventAddOrgPayload>
  );

  useEffect(() => {
    if (onAddOrgFromExternalSource && onAddOrgFromExternalSource.org) {
      handleAddOrg(onAddOrgFromExternalSource.org, onAddOrgFromExternalSource.replaceOrgUniqueId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAddOrgFromExternalSource]);

  /**
   * This is not in a usecallback because it caused an infinite loop since orgs changes a lot and is a dependency
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
        <OrgsCombobox
          orgs={orgs}
          selectedOrg={selectedOrg}
          disabled={actionInProgress}
          onSelected={(org: SalesforceOrgUi) => setSelectedOrgId(org.uniqueId)}
        />
        {selectedOrg && (
          <div className="slds-col slds-m-left--xx-small slds-p-top--xx-small">
            <OrgInfoPopover
              org={selectedOrg}
              loading={orgLoading}
              disableOrgActions={actionInProgress}
              onAddOrg={handleAddOrg}
              onRemoveOrg={handleRemoveOrg}
              onSaveLabel={handleUpdateOrg}
            />
          </div>
        )}
        <div className="slds-col">
          <AddOrg onAddOrg={handleAddOrg} disabled={actionInProgress} />
        </div>
      </div>
    </Fragment>
  );
};

export default OrgsDropdown;
