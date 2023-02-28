import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { CloneEditView, ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { ComboboxWithItemsTypeAhead, Grid, Icon, Tooltip } from '@jetstream/ui';
import { FunctionComponent, useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';
import ViewEditCloneRecord from '../core/ViewEditCloneRecord';

export interface FormulaEvaluatorRecordSearchProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: string;
  disabled: boolean;
  fieldErrorMessage: Maybe<string>;
  onSelectedRecord: (recordId: string) => void;
}

export const FormulaEvaluatorRecordSearch: FunctionComponent<FormulaEvaluatorRecordSearchProps> = ({
  selectedOrg,
  selectedSObject,
  disabled,
  fieldErrorMessage,
  onSelectedRecord,
}) => {
  const [{ defaultApiVersion }] = useRecoilState(applicationCookieState);
  const [records, setRecords] = useState<ListItem<string, any>[]>([]);
  const [selectedRecord, setSelectedRecords] = useState<ListItem<string, any> | null>(null);
  const [viewRecordModalOpen, setViewRecordModalOpen] = useState<boolean>();
  const [viewRecordAction, setViewRecordAction] = useState<CloneEditView>('view');

  const handleSearch = useCallback(
    async (searchTerm: string) => {
      logger.log('search', searchTerm);
      setSelectedRecords(null);
      try {
        if (!selectedSObject) {
          setRecords([]);
          return;
        }
        let soql = `SELECT Id, Name FROM ${selectedSObject} ORDER BY Name LIMIT 50`;
        if (searchTerm) {
          if (searchTerm.length === 15 || searchTerm.length === 18) {
            soql = `SELECT Id, Name FROM ${selectedSObject} WHERE Id = '${searchTerm}' OR Name LIKE '%${searchTerm}%' ORDER BY Name LIMIT 50`;
          } else {
            soql = `SELECT Id, Name FROM ${selectedSObject} WHERE Name LIKE '%${searchTerm}%' ORDER BY Name LIMIT 50`;
          }
        }
        const { queryResults } = await query(selectedOrg, soql);
        setRecords(
          queryResults.records.map((record) => ({
            id: record.Id,
            label: record.Name,
            title: record.Id,
            secondaryLabel: record.Id,
            secondaryLabelOnNewLine: true,
            value: record.Id,
            meta: record,
          }))
        );
      } catch (ex) {
        logger.warn('Error searching records', ex);
        setRecords([]);
      }
    },
    [selectedOrg, selectedSObject]
  );

  function handleSelection(item: ListItem<string, any>) {
    setSelectedRecords(item);
    onSelectedRecord(item?.value);
  }

  return (
    <>
      {viewRecordModalOpen && selectedRecord && (
        <ViewEditCloneRecord
          apiVersion={defaultApiVersion}
          selectedOrg={selectedOrg}
          action={viewRecordAction}
          sobjectName={selectedSObject}
          recordId={selectedRecord.value}
          onClose={() => {
            setViewRecordModalOpen(false);
            setViewRecordAction('view');
          }}
          onChangeAction={setViewRecordAction}
        />
      )}
      <Grid className="slds-m-bottom_x-small" verticalAlign="end">
        <ComboboxWithItemsTypeAhead
          key={selectedSObject}
          comboboxProps={{
            disabled: disabled || !selectedSObject,
            label: 'Record Id',
            className: 'w-100',
            isRequired: true,
            labelHelp: 'Provide a record id to test the formula against',
            placeholder: selectedSObject ? `Search ${selectedSObject} by name or id` : 'Select and object',
            hasError: !!fieldErrorMessage,
            errorMessage: fieldErrorMessage,
          }}
          items={records}
          onSearch={handleSearch}
          selectedItemId={selectedRecord?.id}
          onSelected={handleSelection}
        />
        <Tooltip content={(!disabled && !!selectedRecord && 'View Record Details') || ''}>
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled cursor-pointer slds-m-left_x-small"
            onClick={() => selectedRecord && setViewRecordModalOpen(true)}
            disabled={disabled || !selectedRecord}
          >
            <Icon type="utility" icon="record_lookup" className="slds-button__icon" omitContainer />
          </button>
        </Tooltip>
      </Grid>
    </>
  );
};

export default FormulaEvaluatorRecordSearch;
