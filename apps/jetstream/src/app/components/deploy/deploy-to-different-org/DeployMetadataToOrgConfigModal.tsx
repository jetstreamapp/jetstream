/** @jsx jsx */
import { jsx } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, SalesforceOrgUi } from '@jetstream/types';
import { Icon, Modal } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { salesforceOrgsOmitSelectedState } from '../../../app-state';
import OrgsCombobox from '../../../components/core/OrgsCombobox';
import OrgLabelBadge from '../../core/OrgLabelBadge';
import DeployMetadataOptions from '../utils/DeployMetadataOptions';

const DISABLED_OPTIONS = new Set<keyof DeployOptions>(['allowMissingFiles', 'autoUpdatePackage', 'purgeOnDelete', 'singlePackage']);

export interface DeployMetadataToOrgConfigModalProps {
  initialOptions?: DeployOptions;
  sourceOrg: SalesforceOrgUi;
  onSelection?: (deployOptions: DeployOptions) => void;
  onClose: () => void;
  onDeploy: (destinationOrg: SalesforceOrgUi, deployOptions: DeployOptions) => void;
}

export const DeployMetadataToOrgConfigModal: FunctionComponent<DeployMetadataToOrgConfigModalProps> = ({
  initialOptions,
  sourceOrg,
  onSelection,
  onClose,
  onDeploy,
}) => {
  const orgs = useRecoilValue<SalesforceOrgUi[]>(salesforceOrgsOmitSelectedState);
  const [destinationOrg, setDestinationOrg] = useState<SalesforceOrgUi>(null);
  const [isConfigValid, setIsConfigValid] = useState(true);
  const [deployOptions, setDeployOptions] = useState<DeployOptions>(
    initialOptions || {
      allowMissingFiles: false,
      autoUpdatePackage: false,
      checkOnly: false,
      ignoreWarnings: false,
      purgeOnDelete: false,
      rollbackOnError: true,
      singlePackage: true,
      testLevel: undefined,
      runTests: [],
    }
  );

  useNonInitialEffect(() => {
    onSelection?.(deployOptions);
  }, [deployOptions, onSelection]);

  useEffect(() => {
    if (!destinationOrg) {
      setIsConfigValid(false);
    } else if (deployOptions.testLevel === 'RunSpecifiedTests' && deployOptions.runTests.length === 0) {
      setIsConfigValid(false);
    } else {
      setIsConfigValid(true);
    }
  }, [destinationOrg, deployOptions]);

  return (
    <Modal
      header="Deploy Metadata"
      tagline={
        <div className="slds-align_absolute-center">
          Moving changes from <OrgLabelBadge org={sourceOrg} />
          <Icon type="utility" icon="forward" className="slds-icon slds-icon-text-default slds-icon_x-small" />
          {destinationOrg && <OrgLabelBadge org={destinationOrg} />}
          {!destinationOrg && <em className="slds-m-left_xx-small">Select a destination org</em>}
        </div>
      }
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
            Cancel
          </button>
          <button
            className="slds-button slds-button_brand"
            onClick={() => onDeploy(destinationOrg, deployOptions)}
            disabled={!isConfigValid}
          >
            Deploy
          </button>
        </Fragment>
      }
      size="lg"
      onClose={onClose}
    >
      <div className="slds-is-relative">
        {/* ORG LIST */}
        <OrgsCombobox
          isRequired
          label="Deploy change to"
          hideLabel={false}
          placeholder="Select an org"
          orgs={orgs}
          selectedOrg={destinationOrg}
          onSelected={setDestinationOrg}
        />
        <div>
          {/* OPTIONS */}
          <DeployMetadataOptions deployOptions={deployOptions} hiddenOptions={DISABLED_OPTIONS} onChange={setDeployOptions} />
        </div>
      </div>
    </Modal>
  );
};

export default DeployMetadataToOrgConfigModal;
