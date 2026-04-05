import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { clearCacheForOrg, describeSObject, query } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import {
  ColumnWithFilter,
  ComboboxWithItems,
  DataTable,
  Icon,
  Modal,
  NotSeeingRecentMetadataPopover,
  ScopedNotification,
  SearchInput,
  SelectFormatter,
  Spinner,
  fireToast,
  setColumnFromType,
} from '@jetstream/ui';
import {
  CustomFieldRecord,
  ExistingFieldRow,
  FieldValues,
  buildCustomFieldQuery,
  getDeveloperNameFromFieldApiName,
  getExistingFieldRows,
  mapFieldToFieldValues,
  useAmplitude,
} from '@jetstream/ui-core';
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { SELECT_COLUMN_KEY, SelectColumn } from 'react-data-grid';

function getRowKey(row: ExistingFieldRow) {
  return row.key;
}

function getColumns(): ColumnWithFilter<ExistingFieldRow>[] {
  return [
    {
      ...SelectColumn,
      key: SELECT_COLUMN_KEY,
      resizable: false,
      width: 35,
      minWidth: 35,
      maxWidth: 35,
      renderCell: (args) => {
        return SelectColumn.renderCell?.(args) || <SelectFormatter {...args} />;
      },
    },
    {
      ...setColumnFromType<ExistingFieldRow>('label', 'text'),
      name: 'Label',
      key: 'label',
      width: 250,
      filters: ['TEXT' as const],
      resizable: true,
      sortable: true,
    },
    {
      ...setColumnFromType<ExistingFieldRow>('apiName', 'text'),
      name: 'API Name',
      key: 'apiName',
      width: 250,
      filters: ['TEXT' as const],
      resizable: true,
      sortable: true,
    },
    {
      ...setColumnFromType<ExistingFieldRow>('fieldType', 'text'),
      name: 'Type',
      key: 'fieldType',
      width: 150,
      filters: ['SET' as const],
      resizable: true,
      sortable: true,
    },
    {
      ...setColumnFromType<ExistingFieldRow>('helpText', 'text'),
      name: 'Help Text',
      key: 'helpText',
      resizable: true,
      sortable: true,
    },
  ];
}

export interface LoadExistingFieldsModalProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObjects: string[];
  onLoadFields: (rows: FieldValues[]) => void;
  onClose: () => void;
}

export const LoadExistingFieldsModal: FunctionComponent<LoadExistingFieldsModalProps> = ({
  selectedOrg,
  selectedSObjects,
  onLoadFields,
  onClose,
}) => {
  const { trackEvent } = useAmplitude();
  const [sourceObject, setSourceObject] = useState<string>(selectedSObjects.length === 1 ? selectedSObjects[0] : '');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<ExistingFieldRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [globalFilter, setGlobalFilter] = useState<string | null>(null);

  const columns = useMemo(() => getColumns(), []);

  const objectListItems = useMemo(
    () =>
      selectedSObjects.map(
        (sobject): ListItem => ({
          id: sobject,
          label: sobject,
          value: sobject,
        }),
      ),
    [selectedSObjects],
  );

  const [fetchKey, setFetchKey] = useState(0);

  // Fetch describe when source object changes or on refresh
  useEffect(() => {
    if (!sourceObject) {
      setFields([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    setSelectedRows(new Set());

    describeSObject(selectedOrg, sourceObject)
      .then((response) => {
        if (cancelled) {
          return;
        }
        const rows = getExistingFieldRows(response.data.fields, selectedOrg.orgNamespacePrefix);
        setFields(rows);
        if (rows.length === 0) {
          setErrorMessage('No custom fields found on this object.');
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setErrorMessage(err?.message || 'Failed to fetch field metadata.');
        setFields([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedOrg, sourceObject, fetchKey]);

  const handleObjectSelected = useCallback((item: ListItem) => {
    setSourceObject(item.id);
  }, []);

  const handleRefresh = useCallback(async () => {
    await clearCacheForOrg(selectedOrg);
    setFetchKey((prev) => prev + 1);
  }, [selectedOrg]);

  const handleLoadFields = useCallback(async () => {
    if (selectedRows.size === 0) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // Get the selected describe fields
      const selectedFields = fields.filter((row) => selectedRows.has(row.key));

      // Fetch CustomField Metadata individually - Tooling API requires Metadata/FullName
      // queries to return no more than one row at a time.
      // Batched at 5 to limit concurrent server load rather than optimizing for client speed.
      const BATCH_SIZE = 5;
      const customFieldsByDeveloperName = new Map<string, CustomFieldRecord>();
      const batches = splitArrayToMaxSize(selectedFields, BATCH_SIZE);
      let failureCount = 0;

      for (const batch of batches) {
        const batchResults = await Promise.allSettled(
          batch.map(async (row) => {
            const developerName = getDeveloperNameFromFieldApiName(row.apiName);
            const soql = buildCustomFieldQuery(sourceObject, developerName);
            const response = await query<CustomFieldRecord>(selectedOrg, soql, true);
            if (response.queryResults.records.length > 0) {
              customFieldsByDeveloperName.set(developerName, response.queryResults.records[0]);
            }
          }),
        );
        failureCount += batchResults.filter((result) => result.status === 'rejected').length;
      }

      if (failureCount > 0) {
        fireToast({
          message: `Could not fetch full metadata for ${failureCount} field(s). Some details like description may be missing.`,
          type: 'warning',
        });
      }

      // Map each selected field to FieldValues, filtering out any unsupported types
      const mappedRows: FieldValues[] = selectedFields
        .map((row) => {
          const developerName = getDeveloperNameFromFieldApiName(row.apiName);
          const customFieldRecord = customFieldsByDeveloperName.get(developerName);
          // _key will be assigned by the IMPORT_ROWS reducer, use 0 as placeholder
          return mapFieldToFieldValues(row.field, customFieldRecord?.Metadata, 0);
        })
        .filter((row): row is FieldValues => row !== null);

      trackEvent(ANALYTICS_KEYS.sobj_create_field_load_from_org, {
        numFields: mappedRows.length,
        sourceObject,
      });

      onLoadFields(mappedRows);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to import field metadata.');
      fireToast({
        message: 'There was an error importing field metadata.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }, [fields, selectedRows, sourceObject, selectedOrg, trackEvent, onLoadFields, onClose]);

  return (
    <Modal
      header="Import Existing Fields"
      tagline="Import existing fields to update field configuration."
      size="lg"
      closeOnEsc={!submitting}
      closeOnBackdropClick={false}
      onClose={() => !submitting && onClose()}
      directionalFooter
      footer={
        <>
          <div>
            {sourceObject && (
              <NotSeeingRecentMetadataPopover
                header="Missing Fields?"
                label="Not seeing all fields?"
                refreshButtonLabel="Reload Fields"
                loading={loading}
                org={selectedOrg}
                viewInSalesforceSetup={{
                  label: 'View object in Salesforce setup',
                  title: 'View object in Salesforce setup',
                  link: `/lightning/setup/ObjectManager/${sourceObject}/Details/view`,
                }}
                onReload={handleRefresh}
              />
            )}
          </div>
          <button className="slds-button slds-button_neutral" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="slds-button slds-button_brand slds-is-relative"
            onClick={handleLoadFields}
            disabled={selectedRows.size === 0 || submitting}
          >
            {submitting ? (
              <Spinner size="x-small" />
            ) : (
              <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            )}
            Import {selectedRows.size > 0 ? `${formatNumber(selectedRows.size)} ` : ''}
            {selectedRows.size === 1 ? 'Field' : 'Fields'}
          </button>
        </>
      }
      className="slds-p-around_none"
      classStyles={css`
        overflow: hidden;
        display: flex;
        flex-direction: column;
        height: 80vh;
      `}
    >
      <div
        className="slds-is-relative"
        css={css`
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        `}
      >
        <div className="slds-p-around_medium slds-shrink-none">
          {selectedSObjects.length > 1 && sourceObject && (
            <ScopedNotification theme="info" className="slds-m-bottom_small">
              <p>
                Fields will be loaded from <strong>{sourceObject}</strong>, but on deploy they will be applied to all{' '}
                {selectedSObjects.length} selected objects.
              </p>
            </ScopedNotification>
          )}

          {selectedSObjects.length > 1 && (
            <div className="slds-m-bottom_small">
              <ComboboxWithItems
                comboboxProps={{
                  label: 'Select Object',
                  helpText: 'Choose which object to load existing fields from.',
                  isRequired: true,
                }}
                items={objectListItems}
                selectedItemId={sourceObject || null}
                onSelected={handleObjectSelected}
              />
            </div>
          )}

          {errorMessage && !loading && (
            <ScopedNotification theme="warning" className="slds-m-bottom_small">
              <p>{errorMessage}</p>
            </ScopedNotification>
          )}

          {!loading && fields.length > 0 && (
            <SearchInput id="load-fields-filter" placeholder="Search fields..." onChange={setGlobalFilter} />
          )}
        </div>

        {loading && <Spinner />}

        {!loading && fields.length > 0 && (
          <div
            css={css`
              flex: 1 1 auto;
              min-height: 0;
            `}
          >
            <DataTable
              columns={columns}
              data={fields}
              getRowKey={getRowKey}
              includeQuickFilter
              quickFilterText={globalFilter}
              selectedRows={selectedRows}
              onSelectedRowsChange={(rows) => setSelectedRows(rows as Set<string>)}
              rowHeight={28}
              initialSortColumns={[{ columnKey: 'label', direction: 'ASC' }]}
            />
          </div>
        )}

        {!loading && !sourceObject && selectedSObjects.length > 1 && (
          <div className="slds-align_absolute-center slds-m-top_large">
            <p className="slds-text-color_weak">Select an object to view its custom fields.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
