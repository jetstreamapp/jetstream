import { css } from '@emotion/react';
import { getOrgType, useNonInitialEffect, useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { DeployOptions, ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { Grid, GridCol, Icon, Modal } from '@jetstream/ui';
import { OrgLabelBadge } from '@jetstream/ui-core';
import JSZip from 'jszip';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import DeployMetadataOptions from '../utils/DeployMetadataOptions';

const hiddenOptions = new Set<keyof DeployOptions>(['allowMissingFiles', 'autoUpdatePackage', 'performRetrieve', 'singlePackage']);

export interface DeleteMetadataConfigModalProps {
  selectedOrg: SalesforceOrgUi;
  defaultApiVersion: string;
  selectedMetadata: Record<string, ListMetadataResult[]>;
  initialOptions?: DeployOptions;
  onSelection?: (deployOptions: DeployOptions) => void;
  onClose: () => void;
  onDeploy: (file: ArrayBuffer, deployOptions: DeployOptions) => void;
}

export const DeleteMetadataConfigModal: FunctionComponent<DeleteMetadataConfigModalProps> = ({
  selectedOrg,
  defaultApiVersion,
  selectedMetadata,
  initialOptions,
  onSelection,
  onClose,
  onDeploy,
}) => {
  const rollbar = useRollbar();
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<ArrayBuffer>();
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
    if (!file) {
      setIsConfigValid(false);
    } else if (deployOptions.testLevel === 'RunSpecifiedTests' && deployOptions.runTests?.length === 0) {
      setIsConfigValid(false);
    } else {
      setIsConfigValid(true);
    }
  }, [file, deployOptions]);

  useEffect(() => {
    if (selectedMetadata) {
      createFile();
    }
  }, [selectedMetadata]);

  async function createFile() {
    try {
      const destructivePackageXml = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">`,
        ...Object.keys(selectedMetadata).map((type) =>
          [
            '\t<types>',
            ...selectedMetadata[type].map((metadata) => `\t\t<members>${metadata.fullName}</members>`),
            `\t\t<name>${type}</name>`,
            '\t</types>',
          ].join('\n')
        ),
        `</Package>`,
      ].join('\n');
      const zip = new JSZip();
      zip.file('destructiveChanges.xml', destructivePackageXml);
      zip.file(
        'package.xml',
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
          `\t<version>${defaultApiVersion.replace('v', '')}</version>`,
          '</Package>',
        ].join('\n')
      );
      const file = await zip.generateAsync({ type: 'arraybuffer', compressionOptions: { level: 5 } });
      setFile(file);
    } catch (ex) {
      rollbar.critical('Error creating destructive package.xml', getErrorMessageAndStackObj(ex));
    }
  }

  function handleDeploy() {
    file && onDeploy(file, deployOptions);
  }

  return (
    <Modal
      header="Delete metadata from org"
      tagline={
        <div className="slds-align_absolute-center">
          <span className="slds-text-color_destructive">Your metadata will be deleted from</span> <OrgLabelBadge org={selectedOrg} />
        </div>
      }
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" onClick={() => handleDeploy()} disabled={!isConfigValid}>
            {deployOptions.checkOnly ? 'Validate' : 'Deploy'}
          </button>
        </Fragment>
      }
      size="lg"
      onClose={onClose}
    >
      <div className="slds-is-relative" ref={modalBodyRef}>
        <Grid>
          <GridCol className="slds-border_right slds-p-right_x-small">
            <div>
              <p className="slds-text-color_destructive">
                <Icon type="utility" icon="warning" className="slds-icon slds-icon_small slds-icon-text-warning slds-m-right_xxx-small" />
                <strong>This will delete the selected metadata from your org.</strong>
              </p>
              <p>
                If this is a production org and your deployment includes items that require unit tests, such as Apex Classes or Triggers,
                then you must run all tests in the org to meet code coverage requirements.
              </p>
              <div className="slds-m-vertical_x-small">
                Your metadata will be deleted from <strong>{selectedOrg.label}</strong>.
              </div>
              <div>
                {/* OPTIONS */}
                <DeployMetadataOptions
                  deployOptions={deployOptions}
                  hiddenOptions={hiddenOptions}
                  orgType={getOrgType(selectedOrg)}
                  onChange={setDeployOptions}
                />
              </div>
            </div>
          </GridCol>
          <GridCol className="slds-p-left_x-small" size={6} sizeLarge={4}>
            {selectedMetadata && (
              <div>
                <h3 className="slds-text-heading_small slds-p-left_small">Items to Delete</h3>
                <ul
                  className="slds-has-dividers_bottom-space"
                  css={css`
                    max-height: ${(modalBodyRef.current?.clientHeight || 300) - 50}px;
                    overflow-y: scroll;
                    overflow-x: auto;
                  `}
                >
                  {Object.values(selectedMetadata)
                    .flatMap((items) => items)
                    .map((item) => (
                      <li key={item.fullName} className="slds-item">
                        {item.fullName} ({item.type})
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </GridCol>
        </Grid>
      </div>
    </Modal>
  );
};

export default DeleteMetadataConfigModal;
