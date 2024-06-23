import { css } from '@emotion/react';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConnectedSobjectListMultiSelect,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Tooltip,
} from '@jetstream/ui';
import { filterMassUpdateSobject, selectedOrgState } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import * as fromMassUpdateState from '../mass-update-records.state';
import MassUpdateRecordsObjects from './MassUpdateRecordsObjects';
import { useMassUpdateFieldItems } from './useMassUpdateFieldItems';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MassUpdateRecordsSelectionProps {}

export const MassUpdateRecordsSelection: FunctionComponent<MassUpdateRecordsSelectionProps> = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [sobjects, setSobjects] = useRecoilState(fromMassUpdateState.sObjectsState);
  const [selectedSObjects, setSelectedSObjects] = useRecoilState(fromMassUpdateState.selectedSObjectsState);
  const resetRowMapState = useResetRecoilState(fromMassUpdateState.rowsMapState);
  const resetSObjectsState = useResetRecoilState(fromMassUpdateState.sObjectsState);
  const resetSelectedSObjectsState = useResetRecoilState(fromMassUpdateState.selectedSObjectsState);
  const commonFields = useRecoilValue(fromMassUpdateState.commonFields);

  const {
    rows,
    allRowsValid,
    reset,
    clearResults,
    onFieldSelected,
    onLoadChildFields,
    applyCommonField,
    applyCommonOption,
    applyCommonCriteria,
    handleOptionChange,
    handleAddField,
    handleRemoveField,
    validateAllRowRecords,
    validateRowRecords,
  } = useMassUpdateFieldItems(selectedOrg, selectedSObjects);

  const [allRowsValidated, setAllRowsValidated] = useState(false);

  useEffect(() => clearResults(), [clearResults]);

  useEffect(() => {
    if (allRowsValid) {
      setAllRowsValidated(!!rows.length && rows.every((row) => row.validationResults?.isValid));
    } else {
      setAllRowsValidated(false);
    }
  }, [allRowsValid, rows]);

  function handleRefreshSObjects() {
    resetRowMapState();
    resetSObjectsState();
    resetSelectedSObjectsState();
    reset();
  }

  return (
    <Page testId="mass-update-records-selection-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'bundle_config' }} label="Update Records" docsPath="/load/update-records" />
          <PageHeaderActions colType="actions" buttonType="separate">
            {rows.length > 1 && (
              <button className="slds-button slds-button_neutral" disabled={!allRowsValid} onClick={validateAllRowRecords}>
                Validate All
              </button>
            )}
            {allRowsValidated ? (
              <Link className="slds-button slds-button_brand" to="deployment">
                Review Changes
              </Link>
            ) : (
              <Tooltip content={allRowsValidated ? '' : 'Validate all objects to ensure configuration is valid before continuing'}>
                <button className="slds-button slds-button_brand" disabled>
                  Review Changes
                </button>
              </Tooltip>
            )}
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div
            className="slds-col_bump-left"
            css={css`
              min-height: 19px;
            `}
          >
            {!allRowsValid && <span>Configure and validate each selected object to continue.</span>}
          </div>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer
        bottomBuffer={10}
        className="slds-p-horizontal_x-small slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        <Split
          sizes={[30, 70]}
          minSize={[300, 300]}
          gutterSize={sobjects?.length ? 10 : 0}
          className="slds-gutters"
          css={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div className="slds-p-horizontal_x-small">
            <ConnectedSobjectListMultiSelect
              label="Objects to update"
              selectedOrg={selectedOrg}
              sobjects={sobjects}
              selectedSObjects={selectedSObjects}
              filterFn={filterMassUpdateSobject}
              onSobjects={setSobjects}
              onSelectedSObjects={setSelectedSObjects}
              onRefresh={handleRefreshSObjects}
            />
          </div>
          <div className="slds-p-horizontal_x-small">
            {selectedSObjects && (
              <MassUpdateRecordsObjects
                rows={rows}
                commonFields={commonFields}
                onFieldSelected={onFieldSelected}
                onLoadChildFields={onLoadChildFields}
                applyCommonField={applyCommonField}
                applyCommonOption={applyCommonOption}
                applyCommonCriteria={applyCommonCriteria}
                handleOptionChange={handleOptionChange}
                handleAddField={handleAddField}
                handleRemoveField={handleRemoveField}
                validateRowRecords={validateRowRecords}
              />
            )}
          </div>
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};
