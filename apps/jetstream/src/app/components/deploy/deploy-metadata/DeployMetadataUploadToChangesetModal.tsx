/** @jsx jsx */
import { jsx, css } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { Grid, Input, Modal, Picklist, Radio, RadioGroup, Spinner, Textarea } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { ChangeSetPackage } from './deploy-metadata.types';
import { useChangesetList } from './utils/useChangesetList';

export interface DeployMetadataUploadToChangesetModalProps {
  selectedOrg: SalesforceOrgUi;
  initialPackages?: ListItem<string, ChangeSetPackage>[];
  initialPackage?: string;
  initialDescription?: string;
  onChangesetPackages: (changesetPackages: ListItem<string, ChangeSetPackage>[]) => void;
  onSelection: (changesetPackage: string) => void;
  onClose: () => void;
  onDeploy: (changesetPackage: string, changesetDescription: string) => void;
}

export const DeployMetadataUploadToChangesetModal: FunctionComponent<DeployMetadataUploadToChangesetModalProps> = ({
  selectedOrg,
  initialPackages,
  initialPackage,
  initialDescription,
  onChangesetPackages,
  onSelection,
  onClose,
  onDeploy,
}) => {
  const [changesetEntryType, setChangesetEntryType] = useState<'list' | 'manual'>('list');
  const [changesetPackage, setChangesetPackage] = useState<string>(initialPackage || '');
  const [changesetDescription, setChangesetDescription] = useState<string>(initialDescription || '');
  const [loading, setLoading] = useState(false);
  const { loadPackages, loading: loadingChangesetPackages, changesetPackages, hasError } = useChangesetList(selectedOrg, initialPackages);

  useEffect(() => {
    if (changesetPackages && changesetPackages.length) {
      onChangesetPackages(changesetPackages);
    }
  }, [changesetPackages, onChangesetPackages]);

  useNonInitialEffect(() => {
    onSelection(changesetPackage);
  }, [changesetPackage, onSelection]);

  function handleSelection(selectedItems: ListItem<string, ChangeSetPackage>[]) {
    if (selectedItems?.length) {
      setChangesetPackage(selectedItems[0].value);
      setChangesetDescription(selectedItems[0].meta?.Description || '');
    } else {
      setChangesetPackage('');
      setChangesetDescription('');
    }
  }

  return (
    <Modal
      header="Add metadata to Changeset"
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={loadingChangesetPackages}>
            Cancel
          </button>
          <button
            className="slds-button slds-button_brand"
            onClick={() => onDeploy(changesetPackage, changesetDescription)}
            disabled={loadingChangesetPackages || !changesetPackage}
          >
            Deploy
          </button>
        </Fragment>
      }
      size="lg"
      onClose={onClose}
    >
      <div className="slds-is-relative">
        {loadingChangesetPackages && <Spinner />}

        <p>Show org summary</p>
        <p>This will update the last modified date of all items</p>
        <p>You must create your changeset in advance. If you have not yet created an outbound changeset, do so before continuing</p>
        <p>If the changeset name is not unique, the process will fail. :D</p>

        <RadioGroup
          className="slds-m-bottom_xx-small"
          idPrefix="package"
          label="Choose changeset from list"
          required
          labelHelp="Salesforce does not have great support for showing changesets, so if your changeset is not showing in the list, manually enter the name."
        >
          <Radio
            idPrefix="package"
            id="package-list"
            name="package"
            label="Choose changeset from list"
            value="list"
            checked={changesetEntryType === 'list'}
            disabled={loading}
            onChange={(value) => setChangesetEntryType(value as 'list' | 'manual')}
          />
          <Radio
            idPrefix="package"
            id="package-manual-entry"
            name="package"
            label="Manually enter changeset name"
            value="manual"
            checked={changesetEntryType === 'manual'}
            disabled={loading}
            onChange={(value) => setChangesetEntryType(value as 'list' | 'manual')}
          />
        </RadioGroup>

        <div
          css={css`
            margin-bottom: 200px;
          `}
        >
          {changesetEntryType === 'list' && (
            <Grid verticalAlign="end">
              <div className="slds-grow">
                <Picklist
                  isRequired
                  label="Changesets"
                  scrollLength={5}
                  placeholder="Select an Option"
                  items={changesetPackages || []}
                  selectedItemIds={changesetPackage ? [changesetPackage] : undefined}
                  disabled={loadingChangesetPackages || loading}
                  allowDeselection={false}
                  onChange={handleSelection}
                ></Picklist>
              </div>
              <div className="slds-m-horizontal_small">
                <button
                  className="slds-button slds-button_neutral slds-m-top_small"
                  onClick={() => loadPackages()}
                  disabled={loadingChangesetPackages || loading}
                >
                  Refresh Changesets
                </button>
              </div>
            </Grid>
          )}
          {changesetEntryType === 'manual' && (
            <Input
              label="Changesets"
              isRequired
              labelHelp="This is case-sensitive and must match the exact name of the outbound changeset in Salesforce"
            >
              <input
                id="batch-size"
                className="slds-input"
                placeholder="Changeset name"
                value={changesetPackage}
                disabled={loadingChangesetPackages || loading}
                onChange={(event) => setChangesetPackage(event.target.value)}
              />
            </Input>
          )}
          <Textarea id="changeset-description" label="Changeset Description" className="slds-m-top_x-small">
            <textarea
              id="changeset-description"
              className="slds-textarea"
              disabled={loadingChangesetPackages || loading}
              value={changesetDescription}
              onChange={(event) => setChangesetDescription(event.target.value)}
              maxLength={255}
            />
          </Textarea>
        </div>
      </div>
    </Modal>
  );
};

export default DeployMetadataUploadToChangesetModal;
