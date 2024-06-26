import { BulkJobBatchInfo, Maybe, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Checkbox,
  Icon,
  Input,
  Page,
  Section,
  Spinner,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
} from '@jetstream/ui';
import { DeployResults, MassUpdateRecordsDeploymentRow, MetadataRow, selectedOrgState, useDeployRecords } from '@jetstream/ui-core';
import isNumber from 'lodash/isNumber';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilCallback, useRecoilValue, useSetRecoilState } from 'recoil';
import * as fromMassUpdateState from '../mass-update-records.state';

const HEIGHT_BUFFER = 170;
const MAX_BATCH_SIZE = 10000;

const updateDeploymentResultsState =
  (sobject: string, deployResults: DeployResults, fatalError?: boolean) => (priorRowsMap: Map<string, MetadataRow>) => {
    const rowsMap = new Map(priorRowsMap);
    const row: MetadataRow = { ...rowsMap.get(sobject), deployResults: { ...deployResults } } as MetadataRow;
    // Something went horribly wrong (e.x. lost internet connection) mark all as not processed
    if (fatalError && row.deployResults.jobInfo?.batches?.length) {
      row.deployResults.jobInfo = { ...row.deployResults.jobInfo, state: 'Failed' };
      row.deployResults.jobInfo.batches = row.deployResults.jobInfo.batches.map((batch): BulkJobBatchInfo => {
        if (batch.state !== 'Completed') {
          return { ...batch, state: 'NotProcessed' };
        }
        return batch;
      });
    }
    rowsMap.set(row.sobject, row);
    return rowsMap;
  };

export const MassUpdateRecordsDeployment = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const rows = useRecoilValue(fromMassUpdateState.rowsState);
  const [loading, setLoading] = useState(false);
  const [batchSize, setBatchSize] = useState<Maybe<number>>(10000);
  const [batchSizeError, setBatchSizeError] = useState<string | null>(null);
  const [serialMode, setSerialMode] = useState(false);
  const setDeploymentState = useSetRecoilState(fromMassUpdateState.rowsMapState);
  const getRows = useRecoilCallback(
    ({ snapshot }) =>
      () => {
        return snapshot.getLoadable(fromMassUpdateState.rowsState).getValue();
      },
    []
  );
  const handleDeployResults = useCallback(
    (sobject: string, deployResults: DeployResults, fatalError?: boolean) => {
      setDeploymentState(updateDeploymentResultsState(sobject, deployResults, fatalError));
    },
    [setDeploymentState]
  );

  const { loadDataForRows, pollResultsUntilDone } = useDeployRecords(selectedOrg, handleDeployResults);

  useEffect(() => {
    if (rows.every((row) => row.deployResults.done)) {
      setLoading(false);
    }
  }, [rows]);

  async function handleDeploy() {
    setLoading(true);
    await loadDataForRows(rows, { batchSize: batchSize ?? 10000, serialMode });
    pollResultsUntilDone(getRows);
  }

  useEffect(() => {
    if (!isNumber(batchSize) || batchSize <= 0 || batchSize > MAX_BATCH_SIZE) {
      setBatchSizeError(`The batch size must be between 1 and ${MAX_BATCH_SIZE}`);
    } else if (batchSizeError) {
      setBatchSizeError(null);
    }
  }, [batchSize, batchSizeError]);

  function handleBatchSize(event: ChangeEvent<HTMLInputElement>) {
    const value = Number.parseInt(event.target.value);
    if (Number.isInteger(value)) {
      setBatchSize(value);
    } else if (!event.target.value) {
      setBatchSize(null);
    }
  }

  return (
    <Page testId="mass-update-records-deployment-page">
      <Toolbar>
        <ToolbarItemGroup>
          {loading ? (
            <button className="slds-button slds-button_neutral slds-m-right_x-small" disabled>
              <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
              Go Back
            </button>
          ) : (
            <Link className="slds-button slds-button_neutral slds-m-right_x-small" to="..">
              <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
              Go Back
            </Link>
          )}
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button className="slds-button slds-button_brand slds-is-relative" onClick={handleDeploy} disabled={loading || !!batchSizeError}>
            {loading && <Spinner size="small" />}
            Update Records
          </button>
        </ToolbarItemActions>
      </Toolbar>
      <AutoFullHeightContainer bottomBuffer={10} className="slds-p-around_small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        <Section id="mass-update-deploy-options" label="Advanced Options" initialExpanded={false}>
          <div className="slds-p-around_xx-small slds-text-body_small">
            You may need to adjust these options if you are experiencing governor limits.
          </div>
          <Checkbox
            id={'serial-mode'}
            checked={serialMode}
            label={'Serial Mode'}
            labelHelp="Serial mode processes the batches one-by-one instead of parallel."
            disabled={loading}
            onChange={setSerialMode}
          />
          <Input
            label="Batch Size"
            isRequired={true}
            hasError={!!batchSizeError}
            errorMessageId="batch-size-error"
            errorMessage={batchSizeError}
            labelHelp="The batch size determines how many records will be deleted at a time. Only change this if you are experiencing issues with Salesforce governor limits."
          >
            <input
              id="batch-size"
              className="slds-input"
              placeholder="Set batch size"
              value={batchSize || ''}
              aria-describedby={batchSizeError || undefined}
              disabled={loading}
              onChange={handleBatchSize}
            />
          </Input>
        </Section>

        {rows.map((row) => (
          <MassUpdateRecordsDeploymentRow
            key={row.sobject}
            selectedOrg={selectedOrg}
            deployResults={row.deployResults}
            sobject={row.sobject}
            configuration={row.configuration}
            validationResults={row.validationResults}
            batchSize={batchSize ?? 1000}
          />
        ))}
      </AutoFullHeightContainer>
    </Page>
  );
};
