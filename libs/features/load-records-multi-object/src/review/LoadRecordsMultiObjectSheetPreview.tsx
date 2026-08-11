import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import type { ColumnWithFilter, RenderCellProps, RowWithKey } from '@jetstream/ui';
import {
  AutoFullHeightContainer,
  DataTable,
  Grid,
  ScopedNotification,
  SearchInput,
  getRecordErrorColumn,
  getRecordErrorRowHeight,
  withCellValidation,
} from '@jetstream/ui';
import { FunctionComponent, useMemo, useState } from 'react';
import { LoadMultiObjectData } from '../load-records-multi-object-types';
import { SheetPreviewData, SheetPreviewRow, getErrorLocationLabel } from './review-utils';

export interface LoadRecordsMultiObjectSheetPreviewProps {
  dataset: LoadMultiObjectData;
  previewData: SheetPreviewData;
}

function GroupCellRenderer({ row }: RenderCellProps<RowWithKey>) {
  const { _group, _groupSize } = row as SheetPreviewRow;
  if (!_group) {
    return null;
  }
  return (
    <span
      title={`${formatNumber(_groupSize || 0)} ${pluralizeFromNumber(
        'record',
        _groupSize || 0,
      )} in this group. They will all succeed or all fail together.`}
      className="slds-truncate"
    >
      {_group}
    </span>
  );
}

/** One worksheet's data as a virtualized grid with validation errors annotated on the exact cells/rows */
export const LoadRecordsMultiObjectSheetPreview: FunctionComponent<LoadRecordsMultiObjectSheetPreviewProps> = ({
  dataset,
  previewData,
}) => {
  const { rows, bannerErrors, hasRowErrors } = previewData;
  const [quickFilterText, setQuickFilterText] = useState<string | null>(null);

  // Worksheet names allow spaces and punctuation, neither of which is valid in an element id
  const filterInputId = `sheet-filter-${dataset.worksheet.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  const columns = useMemo((): ColumnWithFilter<RowWithKey>[] => {
    const referenceColumnKey = dataset.referenceColumnHeader || 'Reference Id';
    const dataColumns: ColumnWithFilter<RowWithKey>[] = [
      {
        name: referenceColumnKey,
        key: referenceColumnKey,
        frozen: true,
        width: 170,
        resizable: true,
        sortable: true,
        filters: ['TEXT', 'SET'],
        renderCell: withCellValidation(),
      },
      {
        name: 'Group',
        key: '_group',
        width: 110,
        resizable: true,
        sortable: true,
        filters: ['SET'],
        renderCell: GroupCellRenderer,
      },
      ...dataset.headers.map((header): ColumnWithFilter<RowWithKey> => ({
        // show reference columns in the user's own file vocabulary: {AccountId}
        name: dataset.referenceHeaders.has(header) ? `{${header}}` : header,
        key: header,
        resizable: true,
        sortable: true,
        filters: ['TEXT', 'SET'],
        renderCell: withCellValidation(),
      })),
    ];
    if (hasRowErrors) {
      dataColumns.push(getRecordErrorColumn());
    }
    return dataColumns;
  }, [dataset, hasRowErrors]);

  return (
    <div>
      {bannerErrors.length > 0 && (
        <ScopedNotification theme="error" className="slds-m-vertical_x-small">
          <ul className={bannerErrors.length > 1 ? 'slds-list_dotted' : undefined}>
            {bannerErrors.map((error, i) => (
              <li key={i}>
                {error.message} {getErrorLocationLabel(error)}
              </li>
            ))}
          </ul>
        </ScopedNotification>
      )}
      <Grid align="spread" verticalAlign="center" className="slds-m-vertical_x-small">
        <div className="slds-text-color_weak">
          {formatNumber(rows.length)} {pluralizeFromNumber('record', rows.length)} • {dataset.sobject} • {dataset.operation}
          {dataset.operation === 'UPSERT' && dataset.externalId ? ` (${dataset.externalId})` : ''}
        </div>
        <SearchInput id={filterInputId} placeholder="Filter records" onChange={setQuickFilterText} />
      </Grid>
      {rows.length > 0 && (
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25} bufferIfNotRendered={320}>
          <DataTable
            data={rows as RowWithKey[]}
            columns={columns}
            getRowKey={(row) => (row as SheetPreviewRow)._key}
            includeQuickFilter
            quickFilterText={quickFilterText}
            rowHeight={({ row, columnWidths }) => getRecordErrorRowHeight(row, columnWidths)}
            rowClass={(row) => {
              const { status, _fieldErrors } = row as SheetPreviewRow;
              return status || _fieldErrors ? 'save-error' : undefined;
            }}
          />
        </AutoFullHeightContainer>
      )}
    </div>
  );
};

export default LoadRecordsMultiObjectSheetPreview;
