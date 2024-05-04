import { css } from '@emotion/react';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { ChangeSet, InputReadFileContent, ListItem, SalesforceOrgUi } from '@jetstream/types';
import { FileSelector, Grid, GridCol, Modal, Picklist, Spinner, Textarea } from '@jetstream/ui';
import { OrgLabelBadge, OrgsCombobox, salesforceOrgsState } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useChangesetList } from '../utils/useChangesetList';

// TODO: this is used in two places, move to constants
const SPLIT_LINE_COMMA = /(\n|, |,)/g;

export interface DownloadMetadataPackageConfigModalProps {
  selectedOrg: SalesforceOrgUi;
  onClose: () => void;
  onDownloadFromManifest: (destinationOrg: SalesforceOrgUi, packageManifest: string) => void;
  onDownloadFromPackageNames: (destinationOrg: SalesforceOrgUi, packageNames: string[]) => void;
}

export const DownloadMetadataPackageConfigModal: FunctionComponent<DownloadMetadataPackageConfigModalProps> = ({
  selectedOrg: initiallySelectedOrg,
  onClose,
  onDownloadFromManifest,
  onDownloadFromPackageNames,
}) => {
  const orgs = useRecoilValue<SalesforceOrgUi[]>(salesforceOrgsState);
  const [destinationOrg, setDestinationOrg] = useState<SalesforceOrgUi>(initiallySelectedOrg);
  const [file, setFile] = useState<string | null>(null);
  const [filename, setFileName] = useState<string | null>(null);
  const [packageNames, setPackageNames] = useState<string[]>([]);
  const [packageNamesStr, setPackageNamesStr] = useState<string>('');

  const { loadPackages, loading, changesetPackages, hasError } = useChangesetList(destinationOrg);

  useEffect(() => {
    loadPackages();
  }, [loadPackages, destinationOrg]);

  function handleFile({ content, filename }: InputReadFileContent) {
    setFileName(filename);
    setFile(content as string);
  }

  function handleSelectPackage(selectedItems: ListItem<string, ChangeSet>[]) {
    setPackageNames(selectedItems.map((item) => item.value));
  }

  function handleDownloadFromPackageNames() {
    // combine selected packages with manually entered packages
    onDownloadFromPackageNames(
      destinationOrg,
      Array.from(
        new Set(
          packageNames
            .concat(packageNamesStr.replace(SPLIT_LINE_COMMA, ',').split(','))
            .map((item) => item.trim())
            .filter((item) => !!item)
        )
      )
    );
  }

  function isPackageNameDownloadButtonEnabled() {
    if (packageNames.length || setPackageNamesStr.length) {
      return false;
    }
    return true;
  }

  return (
    <Modal
      header="Download metadata from package"
      size="lg"
      onClose={onClose}
      tagline={
        <div className="slds-align_absolute-center">
          Your metadata will be downloaded from from <OrgLabelBadge org={destinationOrg} />
        </div>
      }
    >
      <div
        className="slds-is-relative"
        // Ensure that the org dropdown does not cause the modal body to scroll
        css={css`
          min-height: 475px;
        `}
      >
        <div className="slds-p-around_medium">
          <Grid align="center">
            <GridCol size={12} sizeMedium={6}>
              <OrgsCombobox
                isRequired
                label="Download package from"
                hideLabel={false}
                placeholder="Select an org"
                orgs={orgs}
                selectedOrg={destinationOrg}
                onSelected={setDestinationOrg}
              />
            </GridCol>
          </Grid>
        </div>
        <Grid wrap verticalStretch>
          <GridCol
            className="slds-p-around_medium"
            size={12}
            sizeMedium={6}
            css={css`
              border-bottom: 1px solid #dddbda;
              @media (min-width: 48em) {
                border-right: 1px solid #dddbda;
                border-bottom: none;
              }
            `}
          >
            <h1 className="slds-text-heading_medium slds-m-bottom_small">Download from Package.xml manifest file</h1>
            <p>Provide a package.xml file that will be used to download a package</p>
            <FileSelector
              className="slds-m-top_x-small"
              id="package-manifest"
              label="Package Manifest"
              filename={filename || ''}
              accept={[INPUT_ACCEPT_FILETYPES.XML]}
              userHelpText="Choose package.xml manifest file"
              onReadFile={handleFile}
            ></FileSelector>
            <button
              className="slds-button slds-button_brand slds-m-top_medium"
              onClick={() => file && onDownloadFromManifest(destinationOrg, file)}
              disabled={!file}
            >
              Download
            </button>
          </GridCol>
          <GridCol className="slds-p-around_medium slds-is-relative" size={12} sizeMedium={6}>
            {loading && <Spinner />}
            <h1 className="slds-text-heading_medium slds-m-bottom_small">Download from outbound changeset or unmanaged package</h1>

            <p>Choose packages from the list and/or manually enter the package names</p>
            <Picklist
              className="slds-m-top_x-small"
              allowDeselection
              multiSelection
              label="Outbound Changesets"
              placeholder="Select a Package"
              items={changesetPackages || []}
              selectedItemIds={packageNames}
              disabled={loading}
              onChange={handleSelectPackage}
              hasError={hasError}
              errorMessage="There was a problem loading packages for this org"
              errorMessageId="packages-fetch-error"
            ></Picklist>

            <Textarea
              id="package-names"
              label="Packages Names"
              className="slds-m-top_x-small"
              helpText="One package name per line or comma delimited"
            >
              <textarea
                id="changeset-description"
                className="slds-textarea"
                value={packageNamesStr}
                onChange={(event) => setPackageNamesStr(event.target.value)}
                maxLength={255}
              />
            </Textarea>

            <button
              className="slds-button slds-button_brand slds-m-top_medium"
              onClick={handleDownloadFromPackageNames}
              disabled={isPackageNameDownloadButtonEnabled()}
            >
              Download
            </button>
          </GridCol>
        </Grid>
      </div>
    </Modal>
  );
};

export default DownloadMetadataPackageConfigModal;
