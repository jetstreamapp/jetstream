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
  ariaDisabledButtonProps,
  getAriaKeyshortcuts,
  getModifierKey,
} from '@jetstream/ui';
import { filterMassUpdateSobject } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { recentHistoryItemsDb } from '@jetstream/ui/db';
import { useAtom, useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { FunctionComponent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
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
    handleRecordLimitChange,
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
              <button
                className="slds-button slds-button_neutral"
                {...ariaDisabledButtonProps(!allRowsValid, () => validateAllRowRecords())}
              >
                Validate All
              </button>
            )}
            {/* One stable element for both states: the old disabled-button/Link swap replaced the DOM
                node (losing focus continuity), and a natively disabled button is unfocusable, so
                keyboard users could never reach the tooltip explaining why they cannot continue */}
            <Tooltip
              openDelay={500}
              content={
                allRowsValidated ? (
                  <div className="slds-p-bottom_small">
                    <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
                  </div>
                ) : (
                  'Validate all objects to ensure configuration is valid before continuing'
                )
              }
            >
              <Link
                className="slds-button slds-button_brand"
                aria-keyshortcuts={getAriaKeyshortcuts([getModifierKey(), 'enter'])}
                to="deployment"
                {...ariaDisabledButtonProps(!allRowsValidated, () => handleContinue())}
              >
                Review Changes
              </Link>
            </Tooltip>
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
                handleRecordLimitChange={handleRecordLimitChange}
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
