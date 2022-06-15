import { clearCacheForOrg, clearQueryHistoryForOrg, deleteOrg, getOrgs, updateOrg } from '@jetstream/shared/data';
import { useObservable } from '@jetstream/shared/ui-utils';
import { JetstreamEventAddOrgPayload, SalesforceOrgUi } from '@jetstream/types';
import { Badge, Icon, Tooltip, Grid } from '@jetstream/ui';
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

interface OrgsDropdownProps {
  addOrgsButtonClassName?: string;
}

export const OrgsDropdown: FunctionComponent<OrgsDropdownProps> = ({ addOrgsButtonClassName }) => {
  const [orgs, setOrgs] = useRecoilState<SalesforceOrgUi[]>(fromAppState.salesforceOrgsState);
  const setSelectedOrgId = useSetRecoilState<string>(fromAppState.selectedOrgIdState);
  const actionInProgress = useRecoilValue<boolean>(fromAppState.actionInProgressState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(fromAppState.selectedOrgState);
  const orgType = useRecoilValue(fromAppState.selectedOrgType);
  const [orgLoading, setOrgLoading] = useState(false);
  const { hasMetadataAccess } = useOrgPermissions(selectedOrg);

  // subscribe to org changes from other places in the application
  const onAddOrgFromExternalSource = useObservable(fromJetstreamEvents.getObservable('addOrg') as Observable<JetstreamEventAddOrgPayload>);

  useEffect(() => {
    if (onAddOrgFromExternalSource && onAddOrgFromExternalSource.org) {
      handleAddOrg(
        onAddOrgFromExternalSource.org,
        onAddOrgFromExternalSource.switchActiveOrg,
        onAddOrgFromExternalSource.replaceOrgUniqueId
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAddOrgFromExternalSource]);

  /**
   * This is not in a usecallback because it caused an infinite loop since orgs changes a lot and is a dependency
   * @param org Org to add
   * @param replaceOrgUniqueId Id of org that should be removed from list. Only applicable to fixing org where Id ends up being different
   */
  function handleAddOrg(org: SalesforceOrgUi, switchActiveOrg: boolean, replaceOrgUniqueId?: string) {
    const sortedOrgs = uniqBy(
      orderBy([org, ...orgs.filter((org) => (replaceOrgUniqueId ? org.uniqueId !== replaceOrgUniqueId : true))], 'username'),
      'uniqueId'
    );
    setOrgs(sortedOrgs);
    if (switchActiveOrg) {
      setSelectedOrgId(org.uniqueId);
    }
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
      <Grid noWrap verticalAlign="center">
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
          {orgType && (
            <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType}>
              {orgType}
            </Badge>
          )}
        </div>
        <OrgsCombobox
          orgs={orgs}
          selectedOrg={selectedOrg}
          disabled={actionInProgress}
          onSelected={(org: SalesforceOrgUi) => setSelectedOrgId(org.uniqueId)}
        />
        {selectedOrg && (
          <div className="slds-col slds-m-left--xx-small org-info-button">
            <OrgInfoPopover
              org={selectedOrg}
              loading={orgLoading}
              disableOrgActions={actionInProgress}
              onAddOrg={handleAddOrg}
              onRemoveOrg={handleRemoveOrg}
              onUpdateOrg={handleUpdateOrg}
            />
          </div>
        )}
        <div className="slds-col">
          <AddOrg className={addOrgsButtonClassName} onAddOrg={handleAddOrg} disabled={actionInProgress} />
        </div>
      </Grid>
    </Fragment>
  );
};

export default OrgsDropdown;
