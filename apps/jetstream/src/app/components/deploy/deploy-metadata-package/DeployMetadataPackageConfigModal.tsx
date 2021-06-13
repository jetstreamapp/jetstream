/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { useNonInitialEffect, useRollbar } from '@jetstream/shared/ui-utils';
import { DeployOptions, InputReadFileContent, SalesforceOrgUi } from '@jetstream/types';
import { FileSelector, Grid, GridCol, Modal } from '@jetstream/ui';
import JSZip from 'jszip';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import OrgLabelBadge from '../../core/OrgLabelBadge';
import DeployMetadataOptions from '../utils/DeployMetadataOptions';

const PACKAGE_XML = /^package\.xml$/;
const NESTED_PACKAGE_XML_REGEX = /^[^\\/?%*:|"<>\.]+\/package\.xml$/;

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
  const rollbar = useRollbar();
  const [file, setFile] = useState<ArrayBuffer>();
  const modalBodyRef = useRef<HTMLDivElement>();
  const [filename, setFileName] = useState<string>();
  const [fileContents, setFileContents] = useState<string[]>();
  const [isConfigValid, setIsConfigValid] = useState(true);
  const [{ isSinglePackage, missingPackageXml }, setPackageDetection] = useState({ isSinglePackage: true, missingPackageXml: false });
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
    } else if (deployOptions.testLevel === 'RunSpecifiedTests' && deployOptions.runTests.length === 0) {
      setIsConfigValid(false);
    } else {
      setIsConfigValid(true);
    }
  }, [file, deployOptions]);

  async function handleFile({ content, filename }: InputReadFileContent) {
    setFileName(filename);
    let _content = content as ArrayBuffer;
    try {
      const zip = await JSZip.loadAsync(_content);
      const hasRootPackageXml = zip.filter((path, file) => PACKAGE_XML.test(file.name)).length > 0;
      const hasNestedPackageXml = zip.filter((path, file) => NESTED_PACKAGE_XML_REGEX.test(file.name)).length > 0;
      setPackageDetection({
        isSinglePackage: hasRootPackageXml && !hasNestedPackageXml,
        missingPackageXml: !hasRootPackageXml && !hasNestedPackageXml,
      });
      // check for an remove OSX evil folders from zip and regenerate file
      const evilFolders = zip.filter((path, file) => file.name.startsWith('__MACOSX') || file.name.endsWith('.DS_Store'));
      if (evilFolders.length > 0) {
        evilFolders.forEach((evilFolder) => zip.remove(evilFolder.name));
        _content = await zip.generateAsync({ type: 'arraybuffer', compressionOptions: { level: 5 } });
      }

      setFileContents(Object.keys(zip.files));
    } catch (ex) {
      logger.warn('[ZIP][ERROR]', ex);
      rollbar.error(`JSZip Error: ${ex.message}`, { ex });
      setFileContents(undefined);
    }
    setFile(_content);
  }

  return (
    <Modal
      header="Upload metadata from package"
      tagline={
        <div className="slds-align_absolute-center">
          Your metadata will be uploaded to <OrgLabelBadge org={selectedOrg} />
        </div>
      }
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" onClick={() => onDeploy(file, deployOptions)} disabled={!isConfigValid}>
            Deploy
          </button>
        </Fragment>
      }
      size="lg"
      onClose={onClose}
    >
      <div className="slds-is-relative" ref={modalBodyRef}>
        <Grid>
          <GridCol>
            <div>
              <p>If you have previously downloaded a package, you can deploy it to the same or a different org.</p>
              <div className="slds-m-vertical_x-small">
                The package will be deployed to <strong>{selectedOrg.label}</strong>.
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
                {missingPackageXml && (
                  <div className="slds-form-element__help slds-text-color_error">
                    It appears you are missing a package.xml within your zip file. Make sure you did not include an extra container
                    directory in your zip file.
                  </div>
                )}
              </div>
              <div>
                {/* OPTIONS */}
                <DeployMetadataOptions deployOptions={deployOptions} isSinglePackage={isSinglePackage} onChange={setDeployOptions} />
              </div>
            </div>
          </GridCol>
          <GridCol size={4} sizeSmall={6} sizeLarge={8}>
            {Array.isArray(fileContents) && (
              <div>
                <h3 className="slds-text-heading_small slds-p-left_small">File Contents</h3>
                <ul
                  className="slds-has-dividers_bottom-space"
                  css={css`
                    max-height: ${modalBodyRef.current.clientHeight - 50}px;
                    overflow-y: scroll;
                    overflow-x: auto;
                  `}
                >
                  {fileContents.map((item) => (
                    <li key={item} className="slds-item">
                      {item}
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

export default DeployMetadataPackageConfigModal;
