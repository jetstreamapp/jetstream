import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { usePrimaryActionShortcut } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import {
  AutoFullHeightContainer,
  ConnectedSobjectListMultiSelect,
  KeyboardShortcut,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Tooltip,
  getModifierKey,
} from '@jetstream/ui';
import { filterMassUpdateSobject } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { recentHistoryItemsDb } from '@jetstream/ui/db';
import { useAtom, useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { FunctionComponent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as fromMassUpdateState from '../mass-update-records.state';
import MassUpdateRecordsObjects from './MassUpdateRecordsObjects';
import { useMassUpdateFieldItems } from './useMassUpdateFieldItems';

const HEIGHT_BUFFER = 170;

export interface MassUpdateRecordsSelectionProps {}

export const MassUpdateRecordsSelection: FunctionComponent<MassUpdateRecordsSelectionProps> = () => {
  const navigate = useNavigate();
  const selectedOrg = useAtomValue(selectedOrgState);
  const [sobjects, setSobjects] = useAtom(fromMassUpdateState.sObjectsState);
  const [selectedSObjects, setSelectedSObjects] = useAtom(fromMassUpdateState.selectedSObjectsState);
  const resetRowMapState = useResetAtom(fromMassUpdateState.rowsMapState);
  const resetSObjectsState = useResetAtom(fromMassUpdateState.sObjectsState);
  const resetSelectedSObjectsState = useResetAtom(fromMassUpdateState.selectedSObjectsState);
  const commonFields = useAtomValue(fromMassUpdateState.commonFields);

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

  function handleContinue() {
    if (!sobjects?.length) {
      return;
    }
    recentHistoryItemsDb.addItemToRecentHistoryItems(
      selectedOrg.uniqueId,
      'sobject',
      sobjects.map(({ name }) => name),
    );
  }

  usePrimaryActionShortcut(
    () => {
      handleContinue();
      navigate('deployment');
    },
    { disabled: !allRowsValidated },
  );

  return (
    <Page testId="mass-update-records-selection-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'record_update' }}
            label="Update Records"
            docsPath={APP_ROUTES.LOAD_MASS_UPDATE.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            {rows.length > 1 && (
              <button className="slds-button slds-button_neutral" disabled={!allRowsValid} onClick={validateAllRowRecords}>
                Validate All
              </button>
            )}
            {allRowsValidated ? (
              <Tooltip
                openDelay={500}
                content={
                  <div className="slds-p-bottom_small">
                    <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
                  </div>
                }
              >
                <Link className="slds-button slds-button_brand" to="deployment" onClick={handleContinue}>
                  Review Changes
                </Link>
              </Tooltip>
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
              recentItemsEnabled
              recentItemsKey="sobject"
              filterFn={filterMassUpdateSobject}
              onSobjects={setSobjects}
              onSelectedSObjects={setSelectedSObjects}
              onRefresh={handleRefreshSObjects}
            />
          </div>
          <div className="slds-p-horizontal_x-small">
            {selectedSObjects && (
              <MassUpdateRecordsObjects
                org={selectedOrg}
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
