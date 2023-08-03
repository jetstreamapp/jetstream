import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { AsyncJobNew, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { DropDown, Tooltip, getSfdcRetUrl, salesforceLoginAndRedirect, useConfirmation } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import { Query } from 'soql-parser-js';
import { useAmplitude } from '../../core/analytics';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import BulkUpdateFromQueryModal from './BulkUpdateFromQuery/BulkUpdateFromQueryModal';
import QueryResultsGetRecAsApexModal from './QueryResultsGetRecAsApexModal';

const MAX_NEW_TABS = 50;

export interface QueryResultsMoreActionsProps {
  selectedOrg: SalesforceOrgUi;
  sObject?: Maybe<string>;
  parsedQuery: Maybe<Query>;
  disabled?: boolean;
  records: any[];
  filteredRows: any[];
  selectedRows: any[];
  totalRecordCount: number;
  refreshRecords: () => void;
  onCreateNewRecord: () => void;
}

export const QueryResultsMoreActions: FunctionComponent<QueryResultsMoreActionsProps> = ({
  selectedOrg,
  sObject,
  parsedQuery,
  disabled,
  records,
  filteredRows,
  selectedRows,
  totalRecordCount,
  refreshRecords,
  onCreateNewRecord,
}) => {
  const { trackEvent } = useAmplitude();
  const confirm = useConfirmation();
  const [openModal, setOpenModal] = useState<false | 'bulk-update' | 'apex'>(false);

  function handleBulkRowAction(id: 'bulk-delete' | 'get-as-apex' | 'open-in-new-tab') {
    logger.log({ id, selectedRows });
    switch (id) {
      case 'bulk-delete': {
        const recordCountText = `${selectedRows.length} ${pluralizeIfMultiple('Record', selectedRows)}`;
        confirm({
          content: (
            <div className="slds-m-around_medium">
              <p className="slds-align_absolute-center slds-m-bottom_small">
                Are you sure you want to <span className="slds-text-color_destructive slds-p-left_xx-small">delete {recordCountText}</span>?
              </p>
              <p>
                <strong>These records will be deleted from Salesforce.</strong> If you want to recover deleted records you can use the
                Salesforce recycle bin.
              </p>
            </div>
          ),
        }).then(() => {
          const jobs: AsyncJobNew[] = [
            {
              type: 'BulkDelete',
              title: `Delete ${recordCountText}`,
              org: selectedOrg,
              meta: selectedRows,
            },
          ];
          fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
          trackEvent(ANALYTICS_KEYS.query_BulkDelete, { numRecords: selectedRows.length });
        });
        break;
      }
      case 'get-as-apex': {
        setOpenModal('apex');
        break;
      }
      case 'open-in-new-tab': {
        (selectedRows.length <= 15
          ? Promise.resolve()
          : confirm({
              content: (
                <div className="slds-m-around_medium">
                  <p className="slds-align_absolute-center slds-m-bottom_small">
                    You have a lot of records selected, are you sure you want to open {Math.min(selectedRows.length, MAX_NEW_TABS)} tabs?
                  </p>
                  {selectedRows.length > MAX_NEW_TABS && (
                    <p className="slds-align_absolute-center">
                      Only the first {MAX_NEW_TABS} records will be opened to prevent your browser from crashing.
                    </p>
                  )}
                </div>
              ),
            })
        ).then(() => {
          selectedRows.slice(0, MAX_NEW_TABS).forEach((record) => {
            const { url } = getSfdcRetUrl(record, record.Id);
            salesforceLoginAndRedirect({
              org: selectedOrg,
              returnUrl: url,
              skipFrontDoorAuth: true,
            });
          });
        });
        break;
      }
      default:
        break;
    }
  }

  function handleAction(item: 'bulk-update' | 'new-record') {
    switch (item) {
      case 'bulk-update':
        setOpenModal('bulk-update');
        break;
      case 'new-record':
        onCreateNewRecord();
        break;
      default:
        break;
    }
  }

  function handleBulkUpdateModalClose(didUpdate = false) {
    setOpenModal(false);
    didUpdate && refreshRecords();
  }

  return (
    <Fragment>
      <Tooltip content={!sObject || selectedRows.length === 0 ? 'Select one or more records to enable record actions' : undefined}>
        <DropDown
          className="slds-m-right_xx-small"
          dropDownClassName="slds-dropdown_actions"
          position="right"
          disabled={disabled || selectedRows.length === 0}
          leadingIcon={{ icon: 'table', type: 'utility', description: 'More Actions' }}
          actionText="Selected record actions"
          items={[
            {
              id: 'bulk-delete',
              value: 'Delete Selected Records',
              icon: {
                icon: 'delete',
                type: 'utility',
              },
            },
            {
              id: 'get-as-apex',
              value: 'Turn records into Apex',
              icon: {
                icon: 'apex',
                type: 'utility',
              },
            },
            {
              id: 'open-in-new-tab',
              value: 'Open selected records in Salesforce',
              icon: {
                icon: 'new_window',
                type: 'utility',
              },
            },
          ]}
          onSelected={(item) => handleBulkRowAction(item as 'bulk-delete' | 'get-as-apex' | 'open-in-new-tab')}
        />
      </Tooltip>

      <DropDown
        className="slds-m-right_xx-small"
        dropDownClassName="slds-dropdown_actions"
        position="right"
        leadingIcon={{ icon: 'settings', type: 'utility', description: 'More Actions' }}
        actionText="Record actions"
        disabled={disabled}
        items={[
          { id: 'bulk-update', value: 'Bulk update records', disabled: !sObject || !totalRecordCount || !parsedQuery },
          { id: 'new-record', value: 'Create new record', disabled: !sObject || !parsedQuery },
        ]}
        onSelected={(item) => handleAction(item as 'bulk-update' | 'new-record')}
      />

      {openModal === 'bulk-update' && sObject && totalRecordCount && parsedQuery && (
        <BulkUpdateFromQueryModal
          selectedOrg={selectedOrg}
          sobject={sObject}
          parsedQuery={parsedQuery}
          records={records || []}
          filteredRecords={filteredRows}
          selectedRecords={selectedRows}
          totalRecordCount={totalRecordCount || 0}
          onModalClose={handleBulkUpdateModalClose}
        />
      )}

      {openModal === 'apex' && sObject && (
        <QueryResultsGetRecAsApexModal org={selectedOrg} records={selectedRows} sobjectName={sObject} onClose={() => setOpenModal(false)} />
      )}
    </Fragment>
  );
};

export default QueryResultsMoreActions;
