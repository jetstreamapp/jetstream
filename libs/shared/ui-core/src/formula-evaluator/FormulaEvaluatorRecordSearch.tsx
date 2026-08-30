/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { describeSObject, query } from '@jetstream/shared/data';
import { appActionObservable, escapeSoqlString, isValidSalesforceRecordId } from '@jetstream/shared/ui-utils';
import { ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { ComboboxWithItemsTypeAhead, Grid, Icon, Tooltip } from '@jetstream/ui';
import { FunctionComponent, useCallback, useRef, useState } from 'react';
import { useAnalytics } from '../analytics';

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
  const nameField = useRef<{ selectedSObject: string; nameField: string }>(null);
  const [records, setRecords] = useState<ListItem<string, any>[]>([]);
  const [selectedRecord, setSelectedRecords] = useState<ListItem<string, any> | null>(null);
  const { trackEvent } = useAnalytics();

  const handleSearch = useCallback(
    async (searchTerm: string) => {
      logger.log('search', searchTerm);
      setSelectedRecords(null);
      try {
        if (!selectedSObject) {
          setRecords([]);
          return;
        }
        if (!nameField.current || nameField.current.selectedSObject !== selectedSObject) {
          nameField.current = {
            selectedSObject,
            nameField: await describeSObject(selectedOrg, selectedSObject).then(
              (result) => result.data.fields.find((field) => field.nameField)?.name || 'Name',
            ),
          };
        }
        const name = nameField.current.nameField;
        const queryRecords = async (whereClause?: string) => {
          const soql = `SELECT Id, ${name} FROM ${selectedSObject}${whereClause ? ` WHERE ${whereClause}` : ''} ORDER BY ${name} LIMIT 50`;
          return (await query(selectedOrg, soql)).queryResults.records;
        };

        let records: any[];
        if (!searchTerm) {
          records = await queryRecords();
        } else {
          const idCondition = `Id = '${escapeSoqlString(searchTerm)}'`;
          const nameCondition = `${name} LIKE '%${escapeSoqlString(searchTerm)}%'`;
          if (!isValidSalesforceRecordId(searchTerm)) {
            records = await queryRecords(nameCondition);
          } else if (selectedSObject.endsWith('__mdt')) {
            // Custom metadata queries do not support OR, so fall back to a name search if the term is not an Id
            records = await queryRecords(idCondition);
            if (!records.length) {
              records = await queryRecords(nameCondition);
            }
          } else {
            records = await queryRecords(`${idCondition} OR ${nameCondition}`);
          }
        }
        setRecords(
          records.map((record) => ({
            id: record.Id,
            label: record[name],
            title: record.Id,
            secondaryLabel: record.Id,
            secondaryLabelOnNewLine: true,
            value: record.Id,
            meta: record,
          })),
        );
      } catch (ex) {
        logger.warn('Error searching records', ex);
        setRecords([]);
      }
    },
    [selectedOrg, selectedSObject],
  );

  function handleSelection(item: ListItem | null) {
    setSelectedRecords(item);
    onSelectedRecord(item?.value ?? '');
  }

  function handleViewRecord() {
    if (selectedRecord) {
      appActionObservable.next({ action: 'VIEW_RECORD', payload: { recordId: selectedRecord.id } });
      trackEvent(ANALYTICS_KEYS.query_RecordAction, { action: 'view', source: 'FORMULA_EDITOR' });
    }
  }

  return (
    <Grid className="slds-m-bottom_x-small" verticalAlign="end">
      <ComboboxWithItemsTypeAhead
        key={selectedSObject}
        comboboxProps={{
          disabled: disabled || !selectedSObject,
          label: 'Record',
          className: 'w-100',
          isRequired: true,
          labelHelp: 'Choose a record to test the formula against',
          placeholder: `Search ${selectedSObject} by name or id`,
          hasError: !!fieldErrorMessage,
          errorMessage: fieldErrorMessage,
        }}
        items={records}
        onSearch={handleSearch}
        selectedItemId={selectedRecord?.id}
        onSelected={handleSelection}
      />
      <div className="slds-m-left_x-small">
        <Tooltip content={(!disabled && !!selectedRecord && 'View Record Details') || ''}>
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled cursor-pointer"
            onClick={handleViewRecord}
            disabled={disabled || !selectedRecord}
          >
            <Icon type="utility" icon="record_lookup" description="View record details" className="slds-button__icon" omitContainer />
          </button>
        </Tooltip>
      </div>
    </Grid>
  );
};

export default FormulaEvaluatorRecordSearch;
