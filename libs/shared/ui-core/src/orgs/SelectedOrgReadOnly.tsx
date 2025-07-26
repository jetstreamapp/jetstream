import { Badge, Grid, Icon, Tooltip } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { Fragment } from 'react';
import { useOrgPermissions } from '..';
import OrgInfoPopover from './OrgInfoPopover';
import OrgPersistence from './OrgPersistence';

export const SelectedOrgReadOnly = () => {
  const actionInProgress = useAtomValue(fromAppState.actionInProgressState);
  const selectedOrg = useAtomValue(fromAppState.selectedOrgStateWithoutPlaceholder);
  const orgType = useAtomValue(fromAppState.selectedOrgType);
  const { hasMetadataAccess } = useOrgPermissions(selectedOrg);

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
        <p className="slds-box slds-box_xx-small">{selectedOrg?.label}</p>
        {selectedOrg && (
          <div className="slds-col slds-m-left--xx-small org-info-button">
            {<OrgInfoPopover org={selectedOrg} disableOrgActions={actionInProgress} isReadOnly />}
          </div>
        )}
      </Grid>
    </Fragment>
  );
};
