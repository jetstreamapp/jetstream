import { css } from '@emotion/react';
import { formatNumber, hasCtrlOrMeta, isEnterKey, useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import { Field, Maybe, SalesforceOrgUi, SobjectCollectionResponse } from '@jetstream/types';
import { Fragment, FunctionComponent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchInput from '../form/search-input/SearchInput';
import AutoFullHeightContainer from '../layout/AutoFullHeightContainer';
import Modal from '../modal/Modal';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import Icon from '../widgets/Icon';
import RecordLookupPopover from '../widgets/RecordLookupPopover';
import Spinner from '../widgets/Spinner';
import Tooltip from '../widgets/Tooltip';
import { DataTable } from './DataTable';
import { getRecordErrorColumn, getRecordErrorRowHeight } from './DataTableRenderers';
import { dataTableDateFormatter } from './data-table-formatters';
import { buildEditedRecordsExport, buildResultsExport, getRecordId } from './data-table-history-export';
import { ColumnWithFilter, DataTableCellProps, RowSalesforceRecordWithKey, RowWithKey } from './data-table-types';
import { getColumnsForGenericTable } from './data-table-utils';

/** Descriptor handed to the host to open the shared FileDownloadModal (CSV/Excel/JSON/Google Drive). */
export interface DownloadConfig {
  data: Record<string, unknown>[];
  header: string[];
  fileNameParts: string[];
  modalHeader: string;
  source: string;
}

/** One row in the preview table — a single modified record, with a column per changed field. */
export interface RecordChangeRow extends RowWithKey {
  recordId: string;
  recordName: string;
  /** Combined record-level status (field + record errors/warnings), or '' when clean. */
  status: string;
  severity: 'error' | 'warning' | 'none';
  /** Column keys this record actually changed — drives the yellow highlight. */
  _changedColumns: Set<string>;
  _fieldErrors: Record<string, string>;
  _fieldWarnings: Record<string, string>;
  /** Original (pre-edit) display value per changed column, shown as a hover tooltip. */
  _oldValues: Record<string, string>;
  /** Set on the post-save snapshot so the status column reads "Saved" instead of "Ready to save". */
  _saved?: boolean;
  /** New display value lives directly at the column key so the generic table renders it. */
  [columnKey: string]: unknown;
}

export interface RecordChangeList {
  rows: RecordChangeRow[];
  /** Union of every changed field across all records, in first-seen order — one table column each. */
  editedColumns: { key: string; label: string }[];
  /** Total changed cells across all records (for the summary banner). */
  changeCount: number;
}

const getRowKey = (row: RowWithKey) => row._key;
const EMPTY_DISPLAY = '—';

function formatDisplayValue(value: unknown, field: Maybe<Field>): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_DISPLAY;
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }
  if (field && (field.type === 'date' || field.type === 'datetime')) {
    return dataTableDateFormatter(value as string) ?? String(value);
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Build the preview table data: ONE row per modified record, with a column for the union of every changed
 * field across all records (matching the downloaded file). New values render at the column key; per-record
 * change/error metadata drives the highlight, error ring, and status. Tolerates missing column/metadata.
 */
export function buildRecordChangeList(
  dirtyRows: RowSalesforceRecordWithKey[],
  columns: ColumnWithFilter<RowSalesforceRecordWithKey>[],
  fieldMetadata: Maybe<Record<string, Field>>,
): RecordChangeList {
  const columnByKey = new Map(columns.map((column) => [column.key, column]));

  // Union of changed columns across all records, in first-seen order.
  const editedKeys: string[] = [];
  const seen = new Set<string>();
  dirtyRows.forEach((row) => {
    if (!(row._touchedColumns instanceof Set)) {
      return;
    }
    row._touchedColumns.forEach((columnKey) => {
      if (row[columnKey] !== row._record?.[columnKey] && !seen.has(columnKey)) {
        seen.add(columnKey);
        editedKeys.push(columnKey);
      }
    });
  });

  const editedColumns = editedKeys.map((key) => {
    const column = columnByKey.get(key);
    const label = fieldMetadata?.[key.toLowerCase()]?.label || (typeof column?.name === 'string' ? column.name : key);
    return { key, label };
  });

  let changeCount = 0;
  const rows: RecordChangeRow[] = dirtyRows.map((row) => {
    const changedColumns = new Set<string>();
    const oldValues: Record<string, string> = {};
    editedKeys.forEach((key) => {
      if (row[key] !== row._record?.[key]) {
        changedColumns.add(key);
        oldValues[key] = formatDisplayValue(row._record?.[key], fieldMetadata?.[key.toLowerCase()]);
      }
    });
    changeCount += changedColumns.size;

    const fieldErrors = row._fieldErrors ?? {};
    const fieldWarnings = row._fieldWarnings ?? {};
    const recordErrors = row._recordErrors ?? [];
    const errorMessages = [...Object.values(fieldErrors), ...recordErrors];
    const warningMessages = Object.values(fieldWarnings);
    const status = errorMessages.length ? errorMessages.join('\n') : warningMessages.length ? warningMessages.join('\n') : '';
    const severity: RecordChangeRow['severity'] = errorMessages.length ? 'error' : warningMessages.length ? 'warning' : 'none';

    const previewRow: RecordChangeRow = {
      _key: row._key,
      recordId: getRecordId(row),
      recordName: row._record?.Name != null ? String(row._record.Name) : '',
      status,
      severity,
      _changedColumns: changedColumns,
      _fieldErrors: fieldErrors,
      _fieldWarnings: fieldWarnings,
      _oldValues: oldValues,
    };
    editedKeys.forEach((key) => {
      previewRow[key] = formatDisplayValue(row[key], fieldMetadata?.[key.toLowerCase()]);
    });
    return previewRow;
  });

  return { rows, editedColumns, changeCount };
}

/** Per-record status as a compact icon (the frozen Status column is narrow); message shown on hover. */
function StatusRenderer({ row }: DataTableCellProps<RowWithKey>): ReactNode {
  const { severity, status, _saved } = row as RecordChangeRow;
  if (_saved) {
    return (
      <Tooltip content="Saved">
        <Icon
          type="utility"
          icon="check"
          className="slds-icon slds-icon_xx-small slds-icon-text-success"
          containerClassname="slds-icon_container"
        />
      </Tooltip>
    );
  }
  if (severity === 'none') {
    return (
      <Tooltip content="Ready to save">
        <Icon
          type="utility"
          icon="success"
          className="slds-icon slds-icon_xx-small slds-icon-text-success"
          containerClassname="slds-icon_container"
        />
      </Tooltip>
    );
  }
  return (
    <Tooltip
      content={
        <span
          css={css`
            white-space: pre-line;
          `}
        >
          {severity === 'warning' ? `Warnings: ${status}` : status}
        </span>
      }
    >
      <Icon
        type="utility"
        icon={severity === 'warning' ? 'warning' : 'error'}
        className={`slds-icon slds-icon_xx-small ${severity === 'warning' ? 'slds-icon-text-warning' : 'slds-icon-text-error'}`}
        containerClassname="slds-icon_container"
      />
    </Tooltip>
  );
}

/** A changed-field cell: shows the new value (old value on hover) plus an error/warning icon when present. */
function FieldCellRenderer({ row, column }: DataTableCellProps<RowWithKey>): ReactNode {
  const changeRow = row as RecordChangeRow;
  const key = column.key;
  const value = changeRow[key] as string;
  const error = changeRow._fieldErrors?.[key];
  const warning = error ? undefined : changeRow._fieldWarnings?.[key];
  const message = error || warning;
  const changed = changeRow._changedColumns?.has(key);
  const title = changed && changeRow._oldValues?.[key] !== undefined ? `Previous: ${changeRow._oldValues[key]}` : undefined;
  if (!message) {
    return (
      <div className="slds-truncate" title={title}>
        {value}
      </div>
    );
  }
  return (
    <Fragment>
      <div
        className="slds-truncate"
        title={title}
        css={css`
          flex: 1 1 auto;
          min-width: 0;
        `}
      >
        {value}
      </div>
      <Tooltip ariaRole="label" content={message}>
        <Icon
          type="utility"
          icon={error ? 'error' : 'warning'}
          className={`slds-icon slds-icon_xx-small slds-m-left_xx-small ${error ? 'slds-icon-text-error' : 'slds-icon-text-warning'}`}
          containerClassname="slds-icon_container"
        />
      </Tooltip>
    </Fragment>
  );
}

/** Cell class for a changed-field column: yellow when this record changed it, error/warning ring on issues. */
function fieldCellClass(row: RowWithKey, columnKey: string): string {
  const changeRow = row as RecordChangeRow;
  const classes = ['slds-truncate'];
  if (changeRow._changedColumns?.has(columnKey)) {
    classes.push('slds-is-edited');
  }
  if (changeRow._fieldErrors?.[columnKey]) {
    classes.push('active-item-error');
  } else if (changeRow._fieldWarnings?.[columnKey]) {
    classes.push('active-item-warning');
  }
  return classes.join(' ');
}

export interface PreviewChangesModalProps {
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  isTooling: boolean;
  dirtyRows: RowSalesforceRecordWithKey[];
  columns: ColumnWithFilter<RowSalesforceRecordWithKey>[];
  fieldMetadata: Maybe<Record<string, Field>>;
  isSaving: boolean;
  hasBlockingErrors: boolean;
  saveErrors: string[];
  /** Raw response from the most recent save, used to offer a results download. */
  saveResults: Maybe<SobjectCollectionResponse>;
  onSave: () => void | Promise<void>;
  /** Open the host's file-download modal (CSV/Excel/JSON/Google Drive) with the given data. */
  onDownload: (config: DownloadConfig) => void;
  /** Hide (without unmounting) while a secondary modal — e.g. the file-download modal — is open on top. */
  isHidden?: boolean;
  /** Revert all pending edits and close. */
  onDiscard: () => void;
  onClose: () => void;
}

/**
 * Read-only review of every pending inline edit before saving. The save button calls the parent's save
 * handler; the parent's state then flows back as props (successful rows leave `dirtyRows`, errors
 * repopulate `saveErrors`), so the modal reflects the result without owning any save logic.
 */
export const PreviewChangesModal: FunctionComponent<PreviewChangesModalProps> = ({
  org,
  serverUrl,
  skipFrontdoorLogin,
  isTooling,
  dirtyRows,
  columns,
  fieldMetadata,
  isSaving,
  hasBlockingErrors,
  saveErrors,
  saveResults,
  onSave,
  onDownload,
  isHidden,
  onDiscard,
  onClose,
}) => {
  const [globalFilter, setGlobalFilter] = useState<string | null>(null);
  // Once the user saves, switch the banner from "review" to a success/error summary.
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  // A successful save empties `dirtyRows` (and thus `changeRows`/`editedColumns`); snapshot the rows and
  // columns at save time so the table can keep showing what was saved instead of collapsing to a banner.
  // The computed export is captured here too: saving mutates each row's `_record` in place to hold the
  // saved values, so re-deriving the edited columns afterward would diff equal and drop every field —
  // capturing the export before the save preserves what we attempted to save (in submit order).
  const [savedSnapshot, setSavedSnapshot] = useState<
    Maybe<{
      rows: RecordChangeRow[];
      columns: ColumnWithFilter<RowWithKey>[];
      editedExport: { data: Record<string, unknown>[]; header: string[] };
    }>
  >(null);

  const {
    rows: changeRows,
    editedColumns,
    changeCount,
  } = useMemo(() => buildRecordChangeList(dirtyRows, columns, fieldMetadata), [dirtyRows, columns, fieldMetadata]);

  const previewColumns = useMemo(
    () =>
      getColumnsForGenericTable([
        // Status + Record Id are frozen so they stay visible while scrolling across the changed-field columns.
        {
          key: 'status',
          label: 'Status',
          columnProps: { frozen: true, width: 80, sortable: false, filters: [], renderCell: StatusRenderer },
        },
        {
          key: 'recordId',
          label: 'Record Id',
          columnProps: {
            frozen: true,
            width: 200,
            renderCell: ({ row }: DataTableCellProps<RowWithKey>) => {
              const { recordId } = row as RecordChangeRow;
              if (!recordId) {
                return null;
              }
              return (
                <RecordLookupPopover
                  org={org}
                  serverUrl={serverUrl}
                  skipFrontDoorAuth={skipFrontdoorLogin}
                  isTooling={isTooling}
                  recordId={recordId}
                  removeFromTabOrder
                />
              );
            },
          },
        },
        { key: 'recordName', label: 'Record', columnProps: { width: 200 } },
        ...editedColumns.map(({ key, label }) => ({
          key,
          label,
          columnProps: {
            width: 200,
            filters: [],
            cellClass: (row: RowWithKey) => fieldCellClass(row, key),
            renderCell: FieldCellRenderer,
          },
        })),
      ]) as ColumnWithFilter<RowWithKey>[],
    [editedColumns, org, serverUrl, skipFrontdoorLogin, isTooling],
  );

  // After a save attempt resolves and there is nothing left to save, surface the success state. The modal
  // blocks grid edits while open, so `dirtyRows` only changes via saves — no effect needed to reconcile it.
  const allSaved = hasAttemptedSave && !isSaving && dirtyRows.length === 0;
  const canDownloadResults = hasAttemptedSave && !isSaving && !!saveResults?.length;

  const handleSave = async () => {
    setHasAttemptedSave(true);
    // Capture the current rows/columns before the save clears them. Mark each row saved and clear any
    // pre-save warnings/errors — once persisted they no longer apply, so the cells render clean.
    setSavedSnapshot({
      rows: changeRows.map((row) => ({
        ...row,
        _saved: true,
        status: '',
        severity: 'none',
        _fieldErrors: {},
        _fieldWarnings: {},
      })),
      columns: previewColumns,
      editedExport: buildEditedRecordsExport(dirtyRows),
    });
    await onSave();
  };

  // Cmd/Ctrl+Enter saves while the modal is open — the same action and guards as the Save button. A live
  // ref (updated in an effect, never during render) keeps the stable global handler reading the latest
  // state without re-registering the listener.
  const saveShortcutRef = useRef<() => void>(() => undefined);
  // Mirror `isHidden` into a ref so the stable handler can bail before preventDefault without re-registering.
  const isHiddenRef = useRef(isHidden);
  useEffect(() => {
    isHiddenRef.current = isHidden;
    saveShortcutRef.current = () => {
      if (allSaved || isSaving || hasBlockingErrors || dirtyRows.length === 0) {
        return;
      }
      handleSave();
    };
  });
  const handleSaveShortcut = useCallback((event: KeyboardEvent) => {
    // The helpers type their param as React's KeyboardEvent; this is the DOM one (same key/modifier props).
    const keyEvent = event as unknown as Parameters<typeof isEnterKey>[0];
    // Ignore while hidden behind a secondary modal (e.g. the file-download modal) so the shortcut neither
    // preventDefaults nor triggers a save from behind it.
    if (isHiddenRef.current || !isEnterKey(keyEvent) || !hasCtrlOrMeta(keyEvent)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    saveShortcutRef.current();
  }, []);
  useGlobalEventHandler('keydown', handleSaveShortcut);

  // After a save attempt, show every record we tried to save: successes come from the snapshot (marked
  // "Saved"), while any failures come from the live `changeRows` (which carry the mapped save errors).
  // This holds for a full success (all from the snapshot — no live failures match), a partial success
  // (a mix), and a full failure (every snapshot row is overridden by its live failure).
  const displayRows = useMemo(() => {
    if (!hasAttemptedSave || !savedSnapshot) {
      return changeRows;
    }
    const failureByKey = new Map(changeRows.map((row) => [row._key, row]));
    return savedSnapshot.rows.map((savedRow) => failureByKey.get(savedRow._key) ?? savedRow);
  }, [hasAttemptedSave, savedSnapshot, changeRows]);
  // A standalone message column whose cell wraps the full (multi-line) text; the row grows to fit via
  // `getRowHeight`. Spliced into the displayed columns only when a row actually has a message. Header reads
  // "Warnings" while everything shown is advisory (pre-save client checks) and "Error" once a real failure
  // (server save error, or a blocking client error) is present.
  const errorColumn = useMemo(() => {
    const hasErrorSeverity = displayRows.some((row) => (row as RecordChangeRow).severity === 'error');
    return getRecordErrorColumn({ name: hasErrorSeverity ? 'Error' : 'Warnings' });
  }, [displayRows]);

  // Keep the Status icon column; additionally surface an inline Error column only once some record has a
  // message (post-save failures, or a pre-save client warning) so the clean review view stays uncluttered.
  // Insert it right after the Record column so the reason sits next to the record it belongs to. Works for
  // both the live columns and the post-save snapshot columns (same leading columns).
  const displayColumns = useMemo(() => {
    const baseColumns = hasAttemptedSave && savedSnapshot ? savedSnapshot.columns : previewColumns;
    if (!displayRows.some((row) => !!(row as RecordChangeRow).status)) {
      return baseColumns;
    }
    const recordNameIndex = baseColumns.findIndex((column) => column.key === 'recordName');
    const insertAt = recordNameIndex >= 0 ? recordNameIndex + 1 : baseColumns.length;
    return [...baseColumns.slice(0, insertAt), errorColumn, ...baseColumns.slice(insertAt)];
  }, [hasAttemptedSave, savedSnapshot, previewColumns, displayRows, errorColumn]);

  // Grow a row to fit its wrapped error message (rows without a message keep the default height). Uses the
  // grid's live column widths so the height tracks a resize of the Error column. No-op when no row has a
  // message — the Error column isn't shown in that case anyway.
  const getRowHeight = useCallback(
    ({ row, columnWidths }: { type: 'ROW' | 'GROUP'; row: RowWithKey; columnWidths: Record<string, number> }) =>
      getRecordErrorRowHeight(row, columnWidths),
    [],
  );

  // The pending edits as exportable rows. Derived live before a save; afterward the rows' `_record`
  // values have been mutated to the saved values (so re-deriving would drop every field), so fall back
  // to the snapshot captured at save time — which also still reflects everything we attempted to save
  // even though the live `dirtyRows` prop has been trimmed to just the failures.
  const editedExport = useMemo(() => savedSnapshot?.editedExport ?? buildEditedRecordsExport(dirtyRows), [savedSnapshot, dirtyRows]);

  const handleDownloadChanges = () => {
    const { data, header } = editedExport;
    onDownload({ data, header, fileNameParts: ['record-changes'], modalHeader: 'Download Changes', source: 'query_inline_edit_changes' });
  };

  const handleDownloadResults = () => {
    if (!saveResults?.length) {
      return;
    }
    const { data, header } = buildResultsExport(editedExport, saveResults);
    onDownload({
      data,
      header,
      fileNameParts: ['save-results'],
      modalHeader: 'Download Save Results',
      source: 'query_inline_edit_results',
    });
  };

  function renderBanner() {
    if (allSaved) {
      return <ScopedNotification theme="success">All changes were saved successfully.</ScopedNotification>;
    }
    if (hasAttemptedSave && saveErrors.length > 0) {
      return <ScopedNotification theme="error">Some records could not be saved. Review the errors below and try again.</ScopedNotification>;
    }
    if (hasBlockingErrors) {
      return <ScopedNotification theme="error">Fix the highlighted errors before saving.</ScopedNotification>;
    }
    return (
      <ScopedNotification theme="info">
        Review {formatNumber(changeCount)} {changeCount === 1 ? 'change' : 'changes'} across {formatNumber(dirtyRows.length)}{' '}
        {dirtyRows.length === 1 ? 'record' : 'records'} before saving.
      </ScopedNotification>
    );
  }

  return (
    <Modal
      size="lg"
      header="Preview Changes"
      hide={isHidden}
      closeDisabled={isSaving}
      closeOnEsc={!isSaving}
      onClose={onClose}
      footer={
        <div className="slds-grid slds-grid_align-spread">
          <div className="slds-grid slds-grid_vertical-align-center">
            {!allSaved && (
              <button className="slds-button slds-button_text-destructive" onClick={onDiscard} disabled={isSaving}>
                Discard Changes
              </button>
            )}
          </div>
          <div className="slds-grid slds-grid_vertical-align-center">
            {editedExport.data.length > 0 && (
              <button className="slds-button slds-button_neutral" onClick={handleDownloadChanges} disabled={isSaving}>
                <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                Download Changes
              </button>
            )}
            {canDownloadResults && (
              <button className="slds-button slds-button_neutral" onClick={handleDownloadResults}>
                <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                Download Results
              </button>
            )}
            <button className="slds-button slds-button_neutral" onClick={onClose} disabled={isSaving}>
              {allSaved ? 'Close' : 'Cancel'}
            </button>
            {!allSaved && (
              <button
                className="slds-button slds-button_brand"
                onClick={handleSave}
                disabled={isSaving || hasBlockingErrors || dirtyRows.length === 0}
                title={hasBlockingErrors ? 'Fix the highlighted errors before saving' : undefined}
              >
                Save ({formatNumber(dirtyRows.length)})
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="slds-is-relative">
        {isSaving && <Spinner />}
        <div className="slds-m-bottom_small">{renderBanner()}</div>
        <div className="slds-m-bottom_x-small">
          <SearchInput id="preview-changes-filter" placeholder="Search changes..." onChange={setGlobalFilter} />
        </div>
        <div
          className="slds-is-relative slds-scrollable_x"
          css={css`
            min-height: 200px;
          `}
        >
          <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
            <DataTable
              columns={displayColumns}
              data={displayRows}
              getRowKey={getRowKey}
              rowHeight={getRowHeight}
              includeQuickFilter
              quickFilterText={globalFilter}
            />
          </AutoFullHeightContainer>
        </div>
      </div>
    </Modal>
  );
};

export default PreviewChangesModal;
