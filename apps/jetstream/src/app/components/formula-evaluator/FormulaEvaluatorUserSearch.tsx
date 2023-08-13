import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { ComboboxWithItemsTypeAhead, Grid } from '@jetstream/ui';
import { FunctionComponent, useCallback, useRef, useState } from 'react';

export interface FormulaEvaluatorUserSearchProps {
  selectedOrg: SalesforceOrgUi;
  disabled: boolean;
  onSelectedRecord: (recordId: string) => void;
}

export const FormulaEvaluatorUserSearch: FunctionComponent<FormulaEvaluatorUserSearchProps> = ({
  selectedOrg,
  disabled,
  onSelectedRecord,
}) => {
  const isFirstRun = useRef(true);
  const [records, setRecords] = useState<ListItem<string, any>[]>([
    {
      id: selectedOrg.userId,
      label: `Current User - ${selectedOrg.username}`,
      secondaryLabel: selectedOrg.userId,
      secondaryLabelOnNewLine: true,
      value: selectedOrg.userId,
    },
  ]);
  const [selectedRecord, setSelectedRecords] = useState<ListItem<string, any> | null>(records[0]);

  const handleSearch = useCallback(
    async (searchTerm: string) => {
      logger.log('search', searchTerm);
      if (!isFirstRun.current) {
        setSelectedRecords(null);
      }
      isFirstRun.current = false;
      try {
        const baseQuery = `SELECT Id, Name, Username, Profile.Name FROM User WHERE Profile.Name != null AND Id != '${selectedOrg.userId}'`;
        let soql = `${baseQuery} ORDER BY Name LIMIT 100`;
        if (searchTerm) {
          if (searchTerm.length === 15 || searchTerm.length === 18) {
            soql = `${baseQuery} AND (Id = '${searchTerm}' OR Name LIKE '%${searchTerm}%') ORDER BY Name LIMIT 100`;
          } else {
            soql = `${baseQuery} AND Name LIKE '%${searchTerm}%' ORDER BY Name LIMIT 100`;
          }
        }
        const { queryResults } = await query<{
          Id: string;
          Name: string;
          Username: string;
          Profile: { Name: string };
        }>(selectedOrg, soql);
        setRecords([
          {
            id: selectedOrg.userId,
            label: `Current User - ${selectedOrg.username}`,
            secondaryLabel: selectedOrg.userId,
            secondaryLabelOnNewLine: true,
            value: selectedOrg.userId,
          },
          ...queryResults.records.map((record) => ({
            id: record.Id,
            label: `${record.Name} - ${record.Username} (${record.Profile.Name})`,
            title: record.Id,
            secondaryLabel: record.Id,
            secondaryLabelOnNewLine: true,
            value: record.Id,
            meta: record,
          })),
        ]);
      } catch (ex) {
        logger.warn('Error searching records', ex);
        setRecords([
          {
            id: selectedOrg.userId,
            label: `Current User - ${selectedOrg.username}`,
            secondaryLabel: selectedOrg.userId,
            secondaryLabelOnNewLine: true,
            value: selectedOrg.userId,
          },
        ]);
      }
    },
    [selectedOrg]
  );

  function handleSelection(item: ListItem<string, any>) {
    setSelectedRecords(item);
    onSelectedRecord(item?.value);
  }

  return (
    <Grid className="slds-m-bottom_x-small" verticalAlign="end">
      <ComboboxWithItemsTypeAhead
        comboboxProps={{
          disabled: disabled,
          label: 'Run as User',
          className: 'w-100',
          isRequired: true,
          labelHelp:
            'Running user applies to the following formula special fields: $CustomMetadata, $Permission, $Profile, $Setup, $User, $UserRole, $System',
        }}
        items={records}
        onSearch={handleSearch}
        selectedItemId={selectedRecord?.id}
        onSelected={handleSelection}
      />
    </Grid>
  );
};

export default FormulaEvaluatorUserSearch;
