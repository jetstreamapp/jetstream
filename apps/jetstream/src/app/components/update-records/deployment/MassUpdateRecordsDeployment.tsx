import { SalesforceOrgUi } from '@jetstream/types';
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
import { isNumber } from 'lodash';
import { ChangeEvent, FunctionComponent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../../app-state';
import * as fromMassUpdateState from '../mass-update-records.state';
import MassUpdateRecordsDeploymentRow from './MassUpdateRecordsDeploymentRow';
import { useDeployRecords } from './useDeployRecords';

const HEIGHT_BUFFER = 170;
const MAX_BATCH_SIZE = 10000;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MassUpdateRecordsDeploymentProps {}

export const MassUpdateRecordsDeployment: FunctionComponent<MassUpdateRecordsDeploymentProps> = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const rows = useRecoilValue(fromMassUpdateState.rowsState);
  const [loading, setLoading] = useState(false);
  const [batchSize, setBatchSize] = useState(10000);
  const [batchSizeError, setBatchSizeError] = useState<string>(null);
  const [serialMode, setSerialMode] = useState(false);
  const { loadDataForRows, pollResultsUntilDone } = useDeployRecords(selectedOrg);

  useEffect(() => {
    if (rows.every((row) => row.deployResults.done)) {
      setLoading(false);
    }
  }, [rows]);

  async function handleDeploy() {
    setLoading(true);
    await loadDataForRows(rows, { batchSize, serialMode });
    pollResultsUntilDone();
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
    <Page>
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
        <Section id="mass-update-deploy-options" label="Options" className="">
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
            labelHelp="The batch size determines how many records will be processed together."
          >
            <input
              id="batch-size"
              className="slds-input"
              placeholder="Set batch size"
              value={batchSize || ''}
              aria-describedby={batchSizeError}
              disabled={loading}
              onChange={handleBatchSize}
            />
          </Input>
        </Section>

        {rows.map((row) => (
          <MassUpdateRecordsDeploymentRow key={row.sobject} selectedOrg={selectedOrg} row={row} batchSize={batchSize} />
        ))}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default MassUpdateRecordsDeployment;
