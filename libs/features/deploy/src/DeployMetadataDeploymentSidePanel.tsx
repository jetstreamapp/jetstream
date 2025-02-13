import { logger } from '@jetstream/shared/client-logger';
import { SalesforceOrgUi, SidePanelType } from '@jetstream/types';
import { Panel } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import DateSelection from './selection-components/DateSelection';
import ManagedPackageSelection from './selection-components/ManagedPackageSelection';
import MetadataSelection from './selection-components/MetadataSelection';
import UserSelection from './selection-components/UserSelection';

function getLabel(activeItem: SidePanelType) {
  switch (activeItem) {
    case 'type-selection':
      return 'Which Metadata Types';
    case 'user-selection':
      return 'Which Users';
    case 'date-range-selection':
      return 'Which Date Range';
    case 'include-managed-selection':
      return 'Include Managed Types';
    default:
      return null;
  }
}

export interface DeployMetadataDeploymentSidePanelProps {
  selectedOrg: SalesforceOrgUi;
  activeItem: SidePanelType;
  isOpen: boolean;
  onClosed: () => void;
}

export const DeployMetadataDeploymentSidePanel: FunctionComponent<DeployMetadataDeploymentSidePanelProps> = ({
  selectedOrg,
  activeItem,
  isOpen,
  onClosed,
}) => {
  const [label, setLabel] = useState<string | null>(() => getLabel(activeItem));

  useEffect(() => {
    setLabel(getLabel(activeItem));
  }, [activeItem]);

  function handleSubmit() {
    onClosed();
  }

  if (!label) {
    logger.warn('No label set, returning null');
    return null;
  }

  return (
    <Panel heading={label} isOpen={isOpen} size="lg" fullHeight={false} position="left" onClosed={handleSubmit}>
      {activeItem === 'type-selection' && (
        <MetadataSelection requireConfirmSelection omitCommonTypes selectedOrg={selectedOrg} onSubmit={handleSubmit} />
      )}
      {activeItem === 'user-selection' && <UserSelection requireConfirmSelection selectedOrg={selectedOrg} onSubmit={handleSubmit} />}
      {activeItem === 'date-range-selection' && <DateSelection requireConfirmSelection onSubmit={handleSubmit} />}
      {activeItem === 'include-managed-selection' && <ManagedPackageSelection requireConfirmSelection onSubmit={handleSubmit} />}
    </Panel>
  );
};

export default DeployMetadataDeploymentSidePanel;
