import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { formatNumber, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { REGEX, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { AsyncJobNew, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { DropDown, Input, getSfdcRetUrl, salesforceLoginAndRedirect, useConfirmation } from '@jetstream/ui';
import { fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { Query } from '@jetstreamapp/soql-parser-js';
import { Fragment, FunctionComponent, useState } from 'react';
import BulkUpdateFromQueryModal from './BulkUpdateFromQuery/BulkUpdateFromQueryModal';
import QueryResultsGetRecAsApexModal from './QueryResultsGetRecAsApexModal';

export const MAX_BATCH = 200;
export const MAX_BULK = 10000;
const MAX_NEW_TABS = 50;

const BatchSize = ({ type = 'BULK', onBatchSizeChange }: { type?: 'BATCH' | 'BULK'; onBatchSizeChange: (val: number) => void }) => {
  const maxSize = type === 'BULK' ? MAX_BULK : MAX_BATCH;
  const [batchSize, setBatchSize] = useState(maxSize);
  useNonInitialEffect(() => {
    onBatchSizeChange(batchSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchSize]);

  return (
    <Input
      label="Batch Size"
      isRequired={true}
      hasError={!batchSize || batchSize > maxSize || batchSize < 1}
      errorMessageId="batch-size-error"
      errorMessage={`Batch size must be between 1 and ${formatNumber(maxSize)}`}
      labelHelp="The batch size determines how many records will be deleted at a time. Only change this if you are experiencing issues with Salesforce governor limits."
    >
      <input
        id="batch-size"
        className="slds-input"
        placeholder="Set batch size"
        value={String(batchSize)}
        aria-describedby={'batch-size-error'}
        onChange={(ev) => {
          setBatchSize(parseInt(ev.target.value.replaceAll(REGEX.NOT_NUMERIC, '') || '0', 10));
        }}
      />
    </Input>
  );
};

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
  const { confirm, setOptions } = useConfirmation();
  const [openModal, setOpenModal] = useState<false | 'bulk-update' | 'apex'>(false);

  function handleAction(id: 'bulk-delete' | 'get-as-apex' | 'open-in-new-tab' | 'bulk-update' | 'new-record') {
    logger.log({ id, selectedRows });
    switch (id) {
      case 'bulk-update': {
        setOpenModal('bulk-update');
        break;
      }
      case 'new-record': {
        onCreateNewRecord();
        break;
      }
      case 'bulk-delete': {
        if (!selectedRows) {
          return;
        }
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
              <BatchSize
                type="BATCH"
                onBatchSizeChange={(batchSize) => {
                  setOptions((prevValue) => ({
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    ...prevValue!,
                    submitDisabled: !batchSize || batchSize > MAX_BULK || batchSize < 1,
                    data: { batchSize },
                  }));
                }}
              />
            </div>
          ),
        })
          .then(({ batchSize }: { batchSize: number }) => {
            const jobs: AsyncJobNew[] = [
              { type: 'BulkDelete', title: `Delete ${recordCountText}`, org: selectedOrg, meta: { batchSize, records: selectedRows } },
            ];
            fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
            trackEvent(ANALYTICS_KEYS.query_BulkDelete, { numRecords: selectedRows.length, source: 'HEADER_ACTION' });
          })
          .catch((ex) => {
            logger.info(ex);
            // user cancelled
          });
        break;
      }
      case 'get-as-apex': {
        if (!selectedRows) {
          return;
        }
        setOpenModal('apex');
        break;
      }
      case 'open-in-new-tab': {
        if (!selectedRows) {
          return;
        }
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

  function handleBulkUpdateModalClose(didUpdate = false) {
    setOpenModal(false);
    didUpdate && refreshRecords();
  }

  return (
    <Fragment>
      <DropDown
        className="slds-m-right_xx-small"
        dropDownClassName="slds-dropdown_actions"
        position="right"
        leadingIcon={{ icon: 'settings', type: 'utility', description: 'More Actions' }}
        actionText="Record actions"
        disabled={disabled}
        items={[
          {
            id: 'bulk-update',
            subheader: 'Actions',
            value: 'Bulk update records',
            disabled: !sObject || !totalRecordCount || !parsedQuery,
            icon: {
              icon: 'upload',
              type: 'utility',
            },
          },
          {
            id: 'new-record',
            value: 'Create new record',
            disabled: !sObject || !parsedQuery,
            trailingDivider: true,
            icon: {
              icon: 'record_create',
              type: 'utility',
            },
          },
          {
            id: 'bulk-delete',
            subheader: 'Selected Record Actions',
            value: 'Delete selected records',
            disabled: disabled || selectedRows.length === 0,
            icon: {
              icon: 'delete',
              type: 'utility',
            },
          },
          {
            id: 'get-as-apex',
            value: 'Convert selected records to Apex',
            disabled: disabled || selectedRows.length === 0,
            icon: {
              icon: 'apex',
              type: 'utility',
            },
          },
          {
            id: 'open-in-new-tab',
            value: 'Open selected records in Salesforce',
            disabled: disabled || selectedRows.length === 0,
            icon: {
              icon: 'new_window',
              type: 'utility',
            },
          },
        ]}
        onSelected={(item) => handleAction(item as 'bulk-delete' | 'get-as-apex' | 'open-in-new-tab' | 'bulk-update' | 'new-record')}
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
