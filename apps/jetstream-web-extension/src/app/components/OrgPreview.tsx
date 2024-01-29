import { useOrgPermissions } from '@jetstream/core/shared-ui';
import { getOrgType } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Badge, Grid, Icon, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import { useMemo } from 'react';

interface OrgPreviewProps {
  selectedOrg: SalesforceOrgUi;
}

export function OrgPreview({ selectedOrg }: OrgPreviewProps) {
  const { hasMetadataAccess } = useOrgPermissions(selectedOrg);
  const orgType = useMemo(() => getOrgType(selectedOrg), [selectedOrg]);

  if (!selectedOrg) {
    return null;
  }

  return (
    <Grid noWrap verticalAlign="center">
      {!hasMetadataAccess && (
        <Tooltip
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
      <Tooltip
        content={
          <div>
            <p>{selectedOrg.instanceUrl}</p>
            <p>{selectedOrg.organizationId}</p>
          </div>
        }
      >
        <Badge type="default">{selectedOrg.username}</Badge>
      </Tooltip>
      <div className="slds-col slds-m-left--xx-small org-info-button">
        {/* <OrgInfoPopover
              org={selectedOrg}
              loading={orgLoading}
              disableOrgActions={actionInProgress}
              onAddOrg={handleAddOrg}
              onRemoveOrg={handleRemoveOrg}
              onUpdateOrg={handleUpdateOrg}
            /> */}
      </div>
    </Grid>
  );
}
