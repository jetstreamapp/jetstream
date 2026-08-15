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
import { useAtom } from 'jotai';
import { FunctionComponent, useMemo, useState } from 'react';
import { MIN_GRID_HEIGHT } from '../load-records-multi-object-constants';
import { LoadMultiObjectData } from '../load-records-multi-object-types';
import { previewLayoutVersionState } from '../load-records-multi-object.state';
import LoadRecordsMultiObjectSheetConfig from './LoadRecordsMultiObjectSheetConfig';
import { SheetPreviewData, SheetPreviewRow, getErrorLocationLabel, getWarningsKey, getWorksheetElementId } from './review-utils';

export interface LoadRecordsMultiObjectSheetPreviewProps {
  dataset: LoadMultiObjectData;
  previewData: SheetPreviewData;
}

/** Grid class that tints a skipped column's header and cells red - defined in the data-table stylesheet */
const SKIPPED_COLUMN_CLASS = 'jgrid-column-excluded';

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
  const { rows, bannerErrors, warnings, skippedHeaders, hasRowErrors } = previewData;
  const [quickFilterText, setQuickFilterText] = useState<string | null>(null);
  const [previewLayoutVersion, setPreviewLayoutVersion] = useAtom(previewLayoutVersionState);

  const filterInputId = getWorksheetElementId('sheet-filter', dataset.worksheet);

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
      ...dataset.headers.map((header): ColumnWithFilter<RowWithKey> => {
        const isSkipped = skippedHeaders.has(header);
        return {
          // show reference columns in the user's own file vocabulary: {AccountId}
          name: dataset.referenceHeaders.has(header) ? `{${header}}` : header,
          key: header,
          resizable: true,
          sortable: true,
          filters: ['TEXT', 'SET'],
          // Skipped columns stay visible so the user can see what was in the file, but read as excluded
          cellClass: isSkipped ? SKIPPED_COLUMN_CLASS : undefined,
          headerCellClass: isSkipped ? SKIPPED_COLUMN_CLASS : undefined,
          renderCell: withCellValidation(),
        };
      }),
    ];
    if (hasRowErrors) {
      dataColumns.push(getRecordErrorColumn());
    }
    return dataColumns;
  }, [dataset, hasRowErrors, skippedHeaders]);

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
      {warnings.length > 0 && (
        <ScopedNotification
          theme="warning"
          className="slds-m-vertical_x-small"
          allowClose
          // Dismissal is keyed to the warnings themselves, so a new file (or an operation change) re-shows them
          dismissResetKey={getWarningsKey(warnings)}
          onClose={() => setPreviewLayoutVersion((version) => version + 1)}
        >
          <ul className={warnings.length > 1 ? 'slds-list_dotted' : undefined}>
            {warnings.map((warning, i) => (
              <li key={i}>
                {warning.message} {getErrorLocationLabel(warning)}
              </li>
            ))}
          </ul>
        </ScopedNotification>
      )}
      <Grid align="spread" verticalAlign="center" className="slds-m-vertical_x-small">
        <Grid verticalAlign="center">
          <span className="slds-text-color_weak slds-m-right_xx-small">
            {formatNumber(rows.length)} {pluralizeFromNumber('record', rows.length)} •
          </span>
          <LoadRecordsMultiObjectSheetConfig dataset={dataset} />
        </Grid>
        <SearchInput id={filterInputId} placeholder="Filter records" onChange={setQuickFilterText} />
      </Grid>
      {rows.length > 0 && (
        <AutoFullHeightContainer
          fillHeight
          setHeightAttr
          bottomBuffer={25}
          bufferIfNotRendered={320}
          minHeight={MIN_GRID_HEIGHT}
          recalculateKey={previewLayoutVersion}
        >
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
