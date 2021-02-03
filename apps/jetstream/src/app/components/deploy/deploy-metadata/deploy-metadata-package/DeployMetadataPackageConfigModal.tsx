/** @jsx jsx */
import { jsx } from '@emotion/react';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, InputReadFileContent, SalesforceOrgUi } from '@jetstream/types';
import { FileSelector, Modal } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import DeployMetadataOptions from '../utils/DeployMetadataOptions';

export interface DeployMetadataPackageConfigModalProps {
  selectedOrg: SalesforceOrgUi;
  initialOptions?: DeployOptions;
  onSelection?: (deployOptions: DeployOptions) => void;
  onClose: () => void;
  onDeploy: (file: ArrayBuffer, deployOptions: DeployOptions) => void;
}

export const DeployMetadataPackageConfigModal: FunctionComponent<DeployMetadataPackageConfigModalProps> = ({
  selectedOrg,
  initialOptions,
  onSelection,
  onClose,
  onDeploy,
}) => {
  const [file, setFile] = useState<ArrayBuffer>();
  const [filename, setFileName] = useState<string>();
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

  async function handleFile({ content, filename }: InputReadFileContent) {
    setFileName(filename);
    setFile(content as ArrayBuffer);
  }

  return (
    <Modal
      header="Upload metadata from Package"
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" onClick={() => onDeploy(file, deployOptions)} disabled={!file}>
            Deploy
          </button>
        </Fragment>
      }
      size="lg"
      onClose={onClose}
    >
      <div className="slds-is-relative">
        <p>If you have previously downloaded a package you can deploy it to the same or a different org.</p>
        <p>
          A common use-case is to move metadata between orgs or to make changes to metadata locally and save the changes back to Salesforce.
        </p>
        <div className="slds-m-vertical_x-small">
          You are about to deploy changes to <strong>{selectedOrg.label}</strong>.
        </div>
        <div className="slds-m-bottom_x-small">
          <FileSelector
            id="upload-package"
            label="Metadata Package (Zip File)"
            filename={filename}
            accept={[INPUT_ACCEPT_FILETYPES.ZIP]}
            userHelpText="Choose zip metadata file"
            onReadFile={handleFile}
          ></FileSelector>
        </div>
        <div>
          {/* OPTIONS */}
          <DeployMetadataOptions deployOptions={deployOptions} onChange={setDeployOptions} />
        </div>
      </div>
    </Modal>
  );
};

export default DeployMetadataPackageConfigModal;
