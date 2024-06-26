import { css } from '@emotion/react';
import { getOrgType, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { DeployOptions, ListMetadataResult, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Grid, GridCol, Icon, Modal } from '@jetstream/ui';
import { OrgLabelBadge, OrgsCombobox, salesforceOrgsOmitSelectedState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import DeployMetadataOptions from '../utils/DeployMetadataOptions';

const DISABLED_OPTIONS = new Set<keyof DeployOptions>(['allowMissingFiles', 'autoUpdatePackage', 'purgeOnDelete', 'singlePackage']);

export interface DeployMetadataToOrgConfigModalProps {
  sourceOrg: SalesforceOrgUi;
  initialOptions?: Maybe<DeployOptions>;
  initialSelectedDestinationOrg?: SalesforceOrgUi;
  selectedMetadata: Record<string, ListMetadataResult[]>;
  onSelection?: (deployOptions: DeployOptions) => void;
  onClose: () => void;
  onDeploy: (destinationOrg: SalesforceOrgUi, deployOptions: DeployOptions) => void;
}

export const DeployMetadataToOrgConfigModal: FunctionComponent<DeployMetadataToOrgConfigModalProps> = ({
  sourceOrg,
  initialOptions,
  initialSelectedDestinationOrg,
  selectedMetadata,
  onSelection,
  onClose,
  onDeploy,
}) => {
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const [selectedMetadataList, setSelectedMetadataList] = useState<string[]>();
  const orgs = useRecoilValue<SalesforceOrgUi[]>(salesforceOrgsOmitSelectedState);
  const [destinationOrg, setDestinationOrg] = useState<SalesforceOrgUi | undefined>(initialSelectedDestinationOrg);
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
    if (selectedMetadata) {
      setSelectedMetadataList(
        Object.keys(selectedMetadata).reduce((output: string[], key) => {
          selectedMetadata[key].forEach((item) => output.push(`${key}: ${decodeURIComponent(item.fullName)}`));
          return output;
        }, [])
      );
    }
  }, [selectedMetadata]);

  useEffect(() => {
    if (!destinationOrg) {
      setIsConfigValid(false);
    } else if (deployOptions.testLevel === 'RunSpecifiedTests' && deployOptions.runTests?.length === 0) {
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
            onClick={() => destinationOrg && onDeploy(destinationOrg, deployOptions)}
            disabled={!isConfigValid}
          >
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
            <div className="slds-is-relative">
              {/* ORG LIST */}
              <OrgsCombobox
                isRequired
                label="Deploy components to"
                hideLabel={false}
                placeholder="Select an org"
                orgs={orgs}
                selectedOrg={destinationOrg}
                onSelected={setDestinationOrg}
              />
              <div>
                {/* OPTIONS */}
                <DeployMetadataOptions
                  deployOptions={deployOptions}
                  hiddenOptions={DISABLED_OPTIONS}
                  orgType={getOrgType(destinationOrg)}
                  onChange={setDeployOptions}
                />
              </div>
            </div>
          </GridCol>
          <GridCol className="slds-p-left_x-small" size={6} sizeLarge={4}>
            {Array.isArray(selectedMetadataList) && (
              <div>
                <h3 className="slds-text-heading_small slds-p-left_small">Selected Items ({selectedMetadataList.length})</h3>
                <ul
                  className="slds-has-dividers_bottom-space"
                  css={css`
                    max-height: ${(modalBodyRef.current?.clientHeight || 300) - 50}px;
                    overflow-y: scroll;
                    overflow-x: auto;
                  `}
                >
                  {selectedMetadataList.map((item) => (
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

export default DeployMetadataToOrgConfigModal;
