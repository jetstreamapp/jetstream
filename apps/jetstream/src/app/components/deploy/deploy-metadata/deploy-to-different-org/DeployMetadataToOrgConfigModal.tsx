/** @jsx jsx */
import { jsx } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, SalesforceOrgUi } from '@jetstream/types';
import { Modal } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { salesforceOrgsState } from '../../../../app-state';
import OrgsCombobox from '../../../../components/core/OrgsCombobox';
import DeployMetadataToOrgConfigOptions from './DeployMetadataToOrgConfigOptions';

const DISABLED_OPTIONS = new Set<keyof DeployOptions>(['allowMissingFiles', 'autoUpdatePackage', 'purgeOnDelete', 'singlePackage']);

export interface DeployMetadataToOrgConfigModalProps {
  initialOptions?: DeployOptions;
  onSelection?: (deployOptions: DeployOptions) => void;
  onClose: () => void;
  onDeploy: (destinationOrg: SalesforceOrgUi, deployOptions: DeployOptions) => void;
}

export const DeployMetadataToOrgConfigModal: FunctionComponent<DeployMetadataToOrgConfigModalProps> = ({
  initialOptions,
  onSelection,
  onClose,
  onDeploy,
}) => {
  const orgs = useRecoilValue<SalesforceOrgUi[]>(salesforceOrgsState);
  const [destinationOrg, setDestinationOrg] = useState<SalesforceOrgUi>(null);
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

  return (
    <Modal
      header="Add metadata to Changeset"
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
            Cancel
          </button>
          <button
            className="slds-button slds-button_brand"
            onClick={() => onDeploy(destinationOrg, deployOptions)}
            disabled={!destinationOrg}
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
          <DeployMetadataToOrgConfigOptions deployOptions={deployOptions} hiddenOptions={DISABLED_OPTIONS} onChange={setDeployOptions} />
        </div>
      </div>
    </Modal>
  );
};

export default DeployMetadataToOrgConfigModal;
